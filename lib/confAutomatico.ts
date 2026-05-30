import QRCode from 'qrcode'
import dayjs from 'dayjs'
import { createClient } from '@supabase/supabase-js'
import { Pix } from './pix'
import { enviarMensagem, enviarImagemBuffer } from './whatsapp'
import { gerarImagemResultado, gerarImagemRenovacao } from './gerarImagem'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const WA_JID  = process.env.WHATSAPP_GRUPO_ID || ''
const API_BASE = 'https://servicebus2.caixa.gov.br/portaldeloterias/api/'
const API_MAP: Record<string, string> = {
  'Lotofácil': 'lotofacil',
  'Mega-Sena': 'megasena',
  'Quina':     'quina',
  'Dupla Sena':'duplasena',
}

const fmtBRL  = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const toBRL   = (v: number) => fmtBRL.format(Number(v || 0))
const sleep   = (ms: number) => new Promise(r => setTimeout(r, ms))
const LIMITE_WA = 3800

const MIN_ACERTOS: Record<string, number> = {
  'Lotofácil': 11, 'Mega-Sena': 4, 'Quina': 2, 'Dupla Sena': 3,
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return v
  const n = Number(String(v ?? '').replace(/\./g, '').replace(',', '.').trim())
  return Number.isFinite(n) ? n : 0
}

function dataBR(data: unknown): string {
  if (!data) return '-'
  if (typeof data === 'string') {
    const m = data.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
    if (m) return `${m[1]}/${m[2]}/${m[3]}`
    const d = new Date(data)
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
    }
    const mi = data.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (mi) return `${mi[3]}/${mi[2]}/${mi[1]}`
  }
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(data as Date)
}

function getWeekdaySP(date = new Date()): number {
  const w = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/Sao_Paulo' }).format(date)
  return ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[w] ??
    new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getDay()
}

function isHojeSorteio(dias: unknown): boolean {
  if (!dias) return false
  const hoje = getWeekdaySP()
  const MAP: Record<string, number> = { DOM: 0, SEG: 1, TER: 2, QUA: 3, QUI: 4, SEX: 5, SAB: 6 }
  return String(dias).split(/[,;|\/ ]+/).filter(Boolean).some(t => {
    const n = parseInt(t, 10)
    if (!isNaN(n)) return (n >= 0 && n <= 6 ? n : n === 7 ? 0 : n) === hoje
    const k = t.normalize('NFD').replace(/[̀-ͯ.]/g, '').trim().toUpperCase().slice(0, 3)
    return MAP[k] === hoje
  })
}

async function fetchComTimeout(url: string, ms = 12000): Promise<Response> {
  const ctrl = new AbortController()
  const id   = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { signal: ctrl.signal }) }
  finally { clearTimeout(id) }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lerNumeros(aposta: any): number[] {
  const fonte = aposta.numeros || aposta.apostas || aposta.aposta || ''
  try {
    if (Array.isArray(fonte)) return fonte.map(Number).filter(Number.isFinite)
    if (typeof fonte === 'string') {
      if (fonte.trim().startsWith('[')) return JSON.parse(fonte).map(Number).filter(Number.isFinite)
      return fonte.split(',').map((s: string) => parseInt(s.trim(), 10)).filter(Number.isFinite)
    }
  } catch { /* */ }
  return []
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function obterQuantidadeParticipantes(grupo: any): number {
  const valor = grupo?.participante ?? grupo?.participantes ?? 0
  if (typeof valor === 'number') return Math.max(1, valor)
  if (typeof valor === 'string') {
    const txt = valor.trim()
    if (!txt) return 1
    const num = Number(txt)
    if (Number.isFinite(num)) return Math.max(1, num)
    try {
      const parsed = JSON.parse(txt)
      if (Array.isArray(parsed)) return Math.max(1, parsed.length)
    } catch { /* */ }
    return 1
  }
  if (Array.isArray(valor)) return Math.max(1, valor.length)
  return 1
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function faixaPorAcertos(modalidade: string, premios: any[], acertos: number) {
  if (!Array.isArray(premios)) return null
  const reNum = new RegExp(`\\b${acertos}\\s+acertos?\\b`, 'i')
  let faixa = premios.find(p => typeof p.descricaoFaixa === 'string' && reNum.test(p.descricaoFaixa))
  if (faixa) return faixa
  const NOMES: Record<string, Record<number, string>> = {
    'Mega-Sena':  { 6: 'Sena', 5: 'Quina', 4: 'Quadra' },
    'Dupla Sena': { 6: 'Sena', 5: 'Quina', 4: 'Quadra' },
    'Quina':      { 5: 'Quina', 4: 'Quadra', 3: 'Terno', 2: 'Duque' },
    'Lotofácil':  { 15: '15 acertos', 14: '14 acertos', 13: '13 acertos', 12: '12 acertos', 11: '11 acertos' },
  }
  const nome = NOMES[modalidade]?.[acertos]
  if (!nome) return null
  const reNome = new RegExp(`\\b${String(nome).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
  return premios.find(p => typeof p.descricaoFaixa === 'string' && reNome.test(p.descricaoFaixa)) || null
}

function splitMsgs(header: string, blocos: string[]): string[] {
  const msgs: string[] = []
  let atual = header || ''
  let first = true
  for (const b of blocos) {
    const sep  = first ? '\n' : '\n\n'
    const cand = (atual ? atual + sep : '') + b
    if (cand.length > LIMITE_WA) {
      if (atual) msgs.push(atual)
      atual = header ? header + '\n' + b : b
      while (atual.length > LIMITE_WA) { msgs.push(atual.slice(0, LIMITE_WA)); atual = atual.slice(LIMITE_WA) }
    } else { atual = cand }
    first = false
  }
  if (atual) msgs.push(atual)
  return msgs
}

function splitIguais<T>(arr: T[], max = 100): T[][] {
  if (!Array.isArray(arr) || !arr.length) return [[]]
  if (arr.length <= max) return [arr]
  const partes = Math.ceil(arr.length / max)
  const base   = Math.floor(arr.length / partes)
  let resto = arr.length % partes
  const out: T[][] = []
  let start = 0
  for (let i = 0; i < partes; i++) {
    const size = base + (resto-- > 0 ? 1 : 0)
    out.push(arr.slice(start, start + size))
    start += size
  }
  return out
}

async function enviarWA(jid: string, texto: string) {
  const dest = String(jid || WA_JID || '').trim()
  if (!dest || !String(texto).trim()) return
  await enviarMensagem(dest, String(texto))
}

async function enviarBlocosWA(waJID: string, header: string, blocos: string[]) {
  const partes = splitIguais(blocos, 100)
  for (const [i, parte] of partes.entries()) {
    const sufixo = partes.length > 1 ? ` (parte ${i + 1})` : ''
    const msgs = splitMsgs(header + sufixo, parte)
    for (const m of msgs) await enviarWA(waJID, m)
  }
}

async function buscarChavePix() {
  try {
    const { data, error } = await supabase.from('chave_pix').select('chave, nome, cidade').order('id', { ascending: false }).limit(1)
    if (error || !data?.length) return { chave: '', nome: 'Bolao', cidade: 'Brasil' }
    return data[0]
  } catch { return { chave: '', nome: 'Bolao', cidade: 'Brasil' } }
}

async function gerarPixDados(valor: number, txid = '***') {
  const pixInfo = await buscarChavePix()
  const p = new Pix(pixInfo.chave, 'Renovacao Bolao', pixInfo.nome, pixInfo.cidade, txid, valor)
  return { payload: p.getPayload() }
}

interface Resultado {
  concurso: number
  data: string
  numeros: number[]
  numeros2: number[] | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  premios: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ganhadores: any[]
  acumulado: boolean
  valorEstimadoProximo: number
  proximoConcurso: number | null
  dataProximoConcurso: string | null
}

async function buscarResultado(modalidade: string, concurso: number, tentativas = 3): Promise<Resultado | null> {
  const rota = API_MAP[modalidade]
  if (!rota) return null
  for (let i = 0; i < tentativas; i++) {
    try {
      const res = await fetchComTimeout(`${API_BASE}/${rota}/${concurso}`)
      if (!res.ok) { if (i < tentativas - 1) { await sleep(3000); continue } return null }
      const data = await res.json()
      if (!data) return null
      const dezenas1 = (data.listaDezenas || []).map(Number).filter(Number.isFinite)
      if (!dezenas1.length) return null
      const resultado: Resultado = {
        concurso: data.numero, data: data.dataApuracao,
        numeros: dezenas1.sort((a: number, b: number) => a - b), numeros2: null,
        premios: data.listaRateioPremio || [], ganhadores: data.listaMunicipioUFGanhadores || [],
        acumulado: data.acumulado || false, valorEstimadoProximo: data.valorEstimadoProximoConcurso || 0,
        proximoConcurso: data.numeroConcursoProximo || null, dataProximoConcurso: data.dataProximoConcurso || null,
      }
      if (modalidade === 'Dupla Sena') {
        const dezenas2 = (data.listaDezenasSegundoSorteio || []).map(Number).filter(Number.isFinite)
        if (!dezenas2.length) return null
        resultado.numeros2 = dezenas2.sort((a: number, b: number) => a - b)
      }
      return resultado
    } catch { if (i === tentativas - 1) return null; await sleep(3000) }
  }
  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function montarHeaderMensagem(modalidade: string, res: Resultado, total: number, acumuladoAntes: number | null = null, acumuladoAtualizado: number | null = null, extra: any = {}) {
  const bola = (n: number) => `🟢${String(n).padStart(2, '0')}`
  const nums  = res.numeros.map(bola).join(' ')
  const nums2 = res.numeros2?.length ? '\n' + res.numeros2.map(bola).join(' ') : ''
  const linhas = [
    `🍀 *Conferência ${modalidade}*`, `📋 Concurso: ${res.concurso}`, `📅 Data: ${dataBR(res.data)}`,
    ``, `🎯 *Números Sorteados*`, nums + nums2, ``, `💰 Prêmio do Dia: ${toBRL(total)}`,
  ]
  if (acumuladoAntes !== null) linhas.push(`📈 Acumulado (antes): ${toBRL(acumuladoAntes)}`)
  if (acumuladoAtualizado !== null) linhas.push(`📊 Acumulado Atualizado: ${toBRL(acumuladoAtualizado)}`)
  if (extra.participantes != null) linhas.push(`👥 Participantes: ${extra.participantes}`)
  if (extra.premioPorParticipante != null) linhas.push(`🏆 Prêmio por participante: ${toBRL(extra.premioPorParticipante)}`)
  return linhas.join('\n')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function montarBlocoJogo(idx: number, nome: string, dest: string, acertos: number, modalidade = '') {
  const min = MIN_ACERTOS[modalidade] || 0
  const badge = acertos === 0 ? `❌ 0 acertos` : acertos >= min ? `✅ *${acertos} acertos* 🏆` : `⚠️ ${acertos} acertos`
  return [``, `🎯 *Aposta ${String(idx + 1).padStart(2, '0')}* — ${nome || '—'}`, dest, badge].join('\n')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatarAposta(nums: number[], sorteados1: number[], sorteados2: number[] | null = null) {
  return nums.map(n => {
    const s  = String(n).padStart(2, '0')
    const h1 = sorteados1.includes(n)
    const h2 = Array.isArray(sorteados2) && sorteados2.includes(n)
    return h1 || h2 ? `🟢${s}` : `⬜${s}`
  }).join(' ')
}

async function deletarEspeciais(modalidade: string, nome_grupo: string) {
  try {
    const { data: rows } = await supabase.from('jogos_mensal').select('id').eq('modalidade', modalidade).eq('nome_grupo', nome_grupo).eq('status', 'A').eq('especial', 'S')
    const ids = (rows || []).map(r => Number(r.id)).filter(Number.isFinite)
    if (!ids.length) return
    await supabase.from('jogos_mensal').delete().in('id', ids)
  } catch (e) { console.error('Erro deletarEspeciais:', e) }
}

export async function processarConferencia() {
  console.log('🚀 Iniciando conferência...')

  const { data: grupos, error: errGrupos } = await supabase.from('grupo_bolao').select('*')
  const { data: linhas, error: errLinhas  } = await supabase.from('jogos_mensal').select('*')

  if (errGrupos) { console.error('Erro ao buscar grupo_bolao:', errGrupos); return }
  if (errLinhas) { console.error('Erro ao buscar jogos_mensal:', errLinhas); return }
  if (!grupos?.length || !linhas?.length) { console.warn('Sem grupos/linhas.'); return }

  const chaves = new Map()
  for (const l of linhas) {
    const k = `${l.modalidade}||${l.nome_grupo}`
    if (!chaves.has(k)) chaves.set(k, l)
  }

  for (const [, cfg] of chaves) {
    console.log(`\n===== ${cfg.modalidade} — ${cfg.nome_grupo} =====`)
    try {
      const normalizar = (s: string) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      const nomeAlvo = normalizar(cfg.nome_grupo)
      const grupo = grupos.find((g: { grupo: string }) => normalizar(g.grupo) === nomeAlvo)
      if (!grupo) { console.warn(`Grupo não encontrado: "${cfg.nome_grupo}"`); continue }

      const waJID = String(grupo.whatsapp_jid || grupo.id_telegram || WA_JID || '').trim()
      if (!waJID) { console.warn(`Grupo "${cfg.nome_grupo}" sem JID`); continue }

      const ativas = linhas.filter((a: { modalidade: string; nome_grupo: string; status: string }) =>
        a.modalidade === cfg.modalidade && a.nome_grupo === cfg.nome_grupo && String(a.status || '').toUpperCase() === 'A'
      )
      if (!ativas.length) { console.warn('Sem apostas ativas.'); continue }

      const status   = String(cfg.status || '').toUpperCase()
      const especial = String(cfg.especial || '').toUpperCase() === 'S'

      if (especial) {
        if (status !== 'A') continue
        const concurso = cfg.concurso_inicio || (cfg.concurso_ultimo ? cfg.concurso_ultimo + 1 : null)
        if (!concurso) { console.warn('Especial: concurso não parametrizado.'); continue }
        const res = await buscarResultado(cfg.modalidade, concurso)
        if (!res) { console.warn('Especial: resultado não disponível.'); continue }

        let total = 0
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blocos = ativas.map((a: any, idx: number) => {
          const nome = a.apostador || a.participante || a.nome || '—'
          const nums = lerNumeros(a)
          const ac1 = nums.filter((n: number) => res.numeros.includes(n)).length
          let acertos = ac1
          if (cfg.modalidade === 'Dupla Sena' && res.numeros2) {
            const ac2 = nums.filter((n: number) => res.numeros2!.includes(n)).length
            if (ac2 > ac1) acertos = ac2
          }
          const faixa = faixaPorAcertos(cfg.modalidade, res.premios, acertos)
          const valor = faixa ? toNum(faixa.valorPremio) : 0
          total += valor
          const premiado = acertos >= (MIN_ACERTOS[cfg.modalidade] || 0)
          return { seq: idx + 1, idx, nome: (a.apostador || '').trim(), nums, acertos, premiado, a }
        })

        const partic    = obterQuantidadeParticipantes(grupo)
        const porPartic = total / partic

        try {
          const imgBuf = await gerarImagemResultado({
            nomeGrupo: cfg.nome_grupo, modalidade: cfg.modalidade, concurso: res.concurso,
            data: dataBR(res.data), numeros: res.numeros, numeros2: res.numeros2,
            premioDia: toBRL(total), acumuladoAntes: toBRL(0), acumuladoAtualizado: toBRL(total),
            apostas: blocos, premios: res.premios, ganhadores: res.ganhadores,
            acumulado: res.acumulado, valorEstimadoProximo: res.valorEstimadoProximo,
            proximoConcurso: res.proximoConcurso, dataProximoConcurso: res.dataProximoConcurso,
          })
          await enviarImagemBuffer(waJID, imgBuf, `${cfg.modalidade} · Concurso ${res.concurso}`)
        } catch (imgErr) {
          console.error('Erro ao gerar imagem:', imgErr)
          const header = montarHeaderMensagem(cfg.modalidade, res, total, null, null, { participantes: partic, premioPorParticipante: porPartic })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const textBlocos = blocos.map(({ idx, nome, nums, acertos }: any) => montarBlocoJogo(idx, nome, formatarAposta(nums, res.numeros, res.numeros2), acertos, cfg.modalidade))
          await enviarBlocosWA(waJID, header, textBlocos)
        }
        await deletarEspeciais(cfg.modalidade, cfg.nome_grupo)
        continue
      }

      if (status !== 'A') continue

      const diasCfg = cfg.dias_sorteio ?? cfg.dias_sorteios ?? ''
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ativasHoje = ativas.filter((a: any) => isHojeSorteio(a.dias_sorteio ?? a.dias_sorteios ?? diasCfg))
      if (!ativasHoje.length) { console.log('Sem apostas para hoje.'); continue }

      const proxConcurso = cfg.concurso_ultimo ? cfg.concurso_ultimo + 1 : cfg.concurso_inicio
      if (!proxConcurso) { console.warn('concurso_ultimo/inicio indefinidos.'); continue }

      const res = await buscarResultado(cfg.modalidade, proxConcurso)
      if (!res) { console.warn('Resultado não disponível.'); continue }

      let total = 0
      const premiosPorAposta: { seq: number; valor: number }[] = []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blocos = ativasHoje.map((a: any, idx: number) => {
        const nums = lerNumeros(a)
        const ac1 = nums.filter((n: number) => res.numeros.includes(n)).length
        let acertos = ac1
        if (cfg.modalidade === 'Dupla Sena' && res.numeros2) {
          const ac2 = nums.filter((n: number) => res.numeros2!.includes(n)).length
          if (ac2 > ac1) acertos = ac2
        }
        const faixa = faixaPorAcertos(cfg.modalidade, res.premios, acertos)
        const valor = faixa ? toNum(faixa.valorPremio) : 0
        total += valor
        if (valor > 0) premiosPorAposta.push({ seq: idx + 1, valor })
        const premiado = acertos >= (MIN_ACERTOS[cfg.modalidade] || 0)
        return { seq: idx + 1, idx, nome: (a.apostador || '').trim(), nums, acertos, premiado, a }
      })

      const { data: apuracoes } = await supabase.from('apuracao_mensal').select('valor_premio').eq('modalidade', cfg.modalidade).eq('nome_grupo', cfg.nome_grupo)
      const acumuladoAntes      = (apuracoes || []).reduce((s: number, a: { valor_premio: unknown }) => s + toNum(a.valor_premio), 0)
      const acumuladoAtualizado = acumuladoAntes + total

      try {
        const imgBuf = await gerarImagemResultado({
          nomeGrupo: cfg.nome_grupo, modalidade: cfg.modalidade, concurso: res.concurso,
          data: dataBR(res.data), numeros: res.numeros, numeros2: res.numeros2,
          premioDia: toBRL(total), acumuladoAntes: toBRL(acumuladoAntes), acumuladoAtualizado: toBRL(acumuladoAtualizado),
          apostas: blocos, premios: res.premios, ganhadores: res.ganhadores,
          acumulado: res.acumulado, valorEstimadoProximo: res.valorEstimadoProximo,
          proximoConcurso: res.proximoConcurso, dataProximoConcurso: res.dataProximoConcurso,
        })
        await enviarImagemBuffer(waJID, imgBuf, `${cfg.modalidade} · Concurso ${res.concurso}`)
      } catch (imgErr) {
        console.error('Erro ao gerar imagem:', imgErr)
        const header = montarHeaderMensagem(cfg.modalidade, res, total, acumuladoAntes, acumuladoAtualizado)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textBlocos = blocos.map(({ idx, nome, nums, acertos }: any) => montarBlocoJogo(idx, nome, formatarAposta(nums, res.numeros, res.numeros2), acertos, cfg.modalidade))
        await enviarBlocosWA(waJID, header, textBlocos)
      }

      if (premiosPorAposta.length) {
        const hoje = dayjs().format('YYYY-MM-DD')
        await supabase.from('apuracao_mensal').upsert(
          premiosPorAposta.map(p => ({ data: hoje, modalidade: cfg.modalidade, nome_grupo: cfg.nome_grupo, aposta_seq: p.seq, valor_premio: p.valor })),
          { onConflict: 'modalidade,nome_grupo,data,aposta_seq' }
        )
      }

      const concursoFim = Number(cfg.concurso_fim || 0)
      if (proxConcurso === concursoFim) {
        const valorJogo  = Number(cfg.valor_aposta || 0)
        const teimosinha = Number(cfg.qtd_teimosinha || 0)
        const partic     = obterQuantidadeParticipantes(grupo)
        const valorRenov = ativas.length * valorJogo * teimosinha
        const valorPagar = valorRenov - acumuladoAtualizado
        const valorRateio = valorPagar / partic
        const temCobranca = valorPagar > 0

        let pixPayload: string | null = null
        let pixQrBuffer: Buffer | null = null
        if (temCobranca) {
          const { payload } = await gerarPixDados(valorRateio)
          pixPayload = payload
          try { pixQrBuffer = await QRCode.toBuffer(pixPayload, { type: 'png', width: 400, margin: 2 }) as unknown as Buffer }
          catch (e) { console.warn('QR Code PIX não gerado:', e) }
        }

        try {
          const renovImg = await gerarImagemRenovacao({
            nomeGrupo: cfg.nome_grupo, modalidade: cfg.modalidade,
            valorRenov: toBRL(valorRenov), acumulado: toBRL(acumuladoAtualizado),
            valorPagar: toBRL(valorPagar), valorRateio: toBRL(valorRateio),
            temCobranca, pixQrBuffer: temCobranca ? pixQrBuffer : null,
          })
          await enviarImagemBuffer(waJID, renovImg, `🔄 Renovação ${cfg.modalidade} · ${cfg.nome_grupo}`)
        } catch (imgErr) {
          console.error('Erro ao gerar imagem renovação:', imgErr)
          const sep = '──────────'
          const msgRenov = [
            `🔄 *Renovação ${cfg.modalidade}*`, ``, `📊 *Resumo Financeiro*`,
            `💵 Valor total: ${toBRL(valorRenov)}`, `✅ Prêmios acumulados: − ${toBRL(acumuladoAtualizado)}`,
            ``, `💳 *Valor a pagar: ${toBRL(valorPagar)}*`, `👤 Por participante: *${toBRL(valorRateio)}*`, ``,
            temCobranca ? `📲 Pagamento via PIX\nQR Code enviado a seguir 👇` : `🎉 *Sem cobrança nesta rodada!*`,
          ].join('\n')
          await enviarWA(waJID, msgRenov)
          if (temCobranca && pixQrBuffer) await enviarImagemBuffer(waJID, pixQrBuffer, `📷 QR Code PIX — ${toBRL(valorRateio)} por participante`)
        }

        if (temCobranca && pixPayload) {
          await enviarWA(waJID, '📋 *PIX Copia e Cola* — copie o código abaixo:')
          await enviarWA(waJID, pixPayload)
        }

        await supabase.from('jogos_mensal').update({
          concurso_inicio: concursoFim + 1, concurso_fim: concursoFim + teimosinha, concurso_ultimo: null,
        }).eq('modalidade', cfg.modalidade).eq('nome_grupo', cfg.nome_grupo)

        await supabase.from('apuracao_mensal').delete().eq('modalidade', cfg.modalidade).eq('nome_grupo', cfg.nome_grupo)
      } else {
        await supabase.from('jogos_mensal').update({ concurso_ultimo: proxConcurso }).eq('modalidade', cfg.modalidade).eq('nome_grupo', cfg.nome_grupo)
      }
    } catch (err) { console.error(`💥 Erro no grupo ${cfg.nome_grupo}:`, err) }
  }

  console.log('✅ Conferência finalizada.')
}

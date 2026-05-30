'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { ListChecks, Play, Trophy, AlertCircle, RefreshCw } from 'lucide-react'
import { FaClover } from 'react-icons/fa6'
import { pad2 } from '@/lib/utils'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'

interface RateioItem {
  faixa?: number
  descricaoFaixa?: string
  descricao?: string      // nome alternativo usado por algumas versões da API
  numeroDeGanhadores: number
  valorPremio: number
  municipioUF?: string
}

interface ResultadoCaixa {
  numero: number
  dataApuracao: string
  listaDezenas?: string[]
  dezenasSorteadasOrdemSorteio?: string[]   // nome alternativo
  listaDezenasSegundoSorteio?: string[]
  listaRateioPremio?: RateioItem[]
  premiacoes?: RateioItem[]                  // nome alternativo
  municipioUF?: string
  localGanhadores?: { municipio: string; uf: string }[]
}

interface JogoConferido {
  id: number
  participante: string
  sequencia: string
  numeros: number[]
  acertos: number
  dezenasSorteio: number[]
  sorteio: string
  ganhou: boolean
}

type Modalidade = 'lotofacil' | 'megasena' | 'quina' | 'duplasena'

const ENDPOINTS: Record<Modalidade, string> = {
  lotofacil: 'lotofacil',
  megasena:  'megasena',
  quina:     'quina',
  duplasena: 'duplasena',
}

const TODAS_MODALIDADES = [
  { value: 'lotofacil',  label: 'Lotofácil',  dbLabel: 'Lotofácil',  cor: '#91278F' },
  { value: 'megasena',   label: 'Mega-Sena',  dbLabel: 'Mega-Sena',  cor: '#00A651' },
  { value: 'quina',      label: 'Quina',      dbLabel: 'Quina',      cor: '#2E3192' },
  { value: 'duplasena',  label: 'Dupla Sena', dbLabel: 'Dupla Sena', cor: '#A62B43' },
]

const MIN_ACERTOS: Record<Modalidade, number> = {
  lotofacil: 11,
  megasena:  4,
  quina:     2,
  duplasena: 3,
}

export default function ConferenciaPage() {
  const { toast } = useToast()
  const [isAdmin, setIsAdmin]                     = useState(false)
  const [modalidade, setModalidade]               = useState<Modalidade | null>(null)
  const [resultado, setResultado]                 = useState<ResultadoCaixa | null>(null)
  const [dezenas1, setDezenas1]                   = useState<number[]>([])
  const [dezenas2, setDezenas2]                   = useState<number[]>([])
  const [jogosConferidos, setJogosConferidos]     = useState<JogoConferido[]>([])
  const [loading, setLoading]                     = useState(false)
  const [executando, setExecutando]               = useState(false)
  const [modalidadesAtivas, setModalidadesAtivas] = useState<string[]>([])

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.auth.getUser(),
      supabase.from('boloes').select('modalidade').eq('status', 'aberto'),
    ]).then(([userRes, boloesRes]) => {
      setIsAdmin(!!userRes.data.user)
      const unicas = [...new Set((boloesRes.data || []).map(b => b.modalidade as string))]
      setModalidadesAtivas(unicas)
      const primeira = TODAS_MODALIDADES.find(m => unicas.includes(m.dbLabel))
      if (primeira) setModalidade(primeira.value as Modalidade)
    })
  }, [])

  const modalidadesDisponiveis = useMemo(
    () => TODAS_MODALIDADES.filter(m => modalidadesAtivas.includes(m.dbLabel)),
    [modalidadesAtivas]
  )

  const metaAtual = TODAS_MODALIDADES.find(m => m.value === modalidade)
  const cor = metaAtual?.cor ?? '#2E3192'

  function acertosDaFaixa(descricao: string): number {
    const m = descricao.match(/(\d+)/)
    return m ? parseInt(m[1]) : -1
  }

  function formatarFaixa(item: RateioItem): string {
    const raw = item.descricaoFaixa || item.descricao || ''
    const n   = acertosDaFaixa(raw)
    if (n > 0) return `${n} ${n === 1 ? 'Acerto' : 'Acertos'}`
    if (/sena/i.test(raw) && !/quina/i.test(raw)) return '6 Acertos (Sena)'
    if (/quina/i.test(raw) && !/mega/i.test(raw)) return '5 Acertos (Quina)'
    if (/quadra/i.test(raw)) return '4 Acertos (Quadra)'
    return raw
  }

  // Retorna o prêmio da Caixa para N acertos
  function premioParaAcertos(acertos: number): number {
    const lista = resultado?.listaRateioPremio
    if (!lista) return 0
    for (const p of lista) {
      const raw = p.descricaoFaixa || p.descricao || ''
      if (acertosDaFaixa(raw) === acertos) return p.valorPremio
    }
    return 0
  }

  async function buscarResultado() {
    if (!modalidade) return
    setLoading(true)
    setResultado(null)
    setDezenas1([])
    setDezenas2([])
    setJogosConferidos([])

    try {
      const supabase = createClient()
      const meta     = TODAS_MODALIDADES.find(m => m.value === modalidade)!

      // Bolão ativo → pega concurso
      const { data: boloes } = await supabase
        .from('boloes')
        .select('id, concurso')
        .eq('status', 'aberto')
        .eq('modalidade', meta.dbLabel)

      if (!boloes?.length) {
        toast('Nenhum bolão aberto para esta modalidade', 'error')
        return
      }

      const concurso = boloes[0].concurso

      // Resultado da Caixa
      const res = await fetch(
        `https://servicebus2.caixa.gov.br/portaldeloterias/api/${ENDPOINTS[modalidade]}/${concurso}`
      )
      if (!res.ok) throw new Error(`Erro ao buscar concurso ${concurso}`)
      const data: ResultadoCaixa = await res.json()

      const dezenasBruto = data.listaDezenas || data.dezenasSorteadasOrdemSorteio
      if (!dezenasBruto?.length) {
        throw new Error('A API não retornou os números sorteados. Verifique o concurso.')
      }

      // normaliza para sempre ter listaDezenas preenchido
      data.listaDezenas = dezenasBruto
      // normaliza premiacoes para listaRateioPremio
      if (!data.listaRateioPremio?.length && data.premiacoes?.length) {
        data.listaRateioPremio = data.premiacoes.map(p => ({
          ...p,
          descricaoFaixa: p.descricaoFaixa || p.descricao || '',
        }))
      }

      setResultado(data)

      const dez1 = dezenasBruto.map(Number).sort((a, b) => a - b)
      const dez2 = (data.listaDezenasSegundoSorteio ?? []).map(Number).sort((a, b) => a - b)
      setDezenas1(dez1)
      setDezenas2(dez2)

      // Jogos do bolão (por bolao_id, fallback por modalidade)
      let { data: jogos } = await supabase
        .from('jogos')
        .select('id, participante, sequencia, aposta')
        .in('bolao_id', boloes.map(b => b.id))

      if (!jogos?.length) {
        const r2 = await supabase
          .from('jogos')
          .select('id, participante, sequencia, aposta')
          .eq('modalidade', meta.dbLabel)
        jogos = r2.data
      }

      if (!jogos?.length) return

      const minGanhar = MIN_ACERTOS[modalidade]
      const isDuplaSena = modalidade === 'duplasena'

      const conferidos: JogoConferido[] = []

      for (const j of jogos) {
        const numeros = j.aposta.split(',').map((n: string) => parseInt(n.trim()))

        // Sorteio 1
        const ac1 = numeros.filter((n: number) => dez1.includes(n)).length
        conferidos.push({
          id: j.id,
          participante: j.participante,
          sequencia: j.sequencia,
          numeros,
          acertos: ac1,
          dezenasSorteio: dez1,
          sorteio: isDuplaSena ? 'Sorteio 1' : '',
          ganhou: ac1 >= minGanhar,
        })

        // Sorteio 2 (Dupla Sena)
        if (isDuplaSena && dez2.length > 0) {
          const ac2 = numeros.filter((n: number) => dez2.includes(n)).length
          conferidos.push({
            id: j.id * 10000 + 2,
            participante: j.participante,
            sequencia: j.sequencia,
            numeros,
            acertos: ac2,
            dezenasSorteio: dez2,
            sorteio: 'Sorteio 2',
            ganhou: ac2 >= minGanhar,
          })
        }
      }

      conferidos.sort((a, b) => b.acertos - a.acertos)
      setJogosConferidos(conferidos)

    } catch (err: unknown) {
      toast((err as Error).message || 'Erro ao buscar resultado', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function executarConferencia() {
    setExecutando(true)
    try {
      const res  = await fetch(`${BACKEND_URL}/api/executar`)
      const data = await res.json()
      if (data.error) throw new Error(data.detalhe || data.error)
      toast('Conferência executada! Resultados enviados ao WhatsApp.', 'success')
    } catch (err: unknown) {
      toast((err as Error).message || 'Erro ao executar conferência', 'error')
    } finally {
      setExecutando(false)
    }
  }

  const ganhadores  = jogosConferidos.filter(j => j.ganhou)
  const totalPremio = ganhadores.reduce((s, j) => s + premioParaAcertos(j.acertos), 0)
  // cotas = jogos únicos (sem duplicar Dupla Sena)
  const totalCotas  = modalidade === 'duplasena'
    ? new Set(jogosConferidos.map(j => Math.floor(j.id / 10000) || j.id)).size
    : jogosConferidos.length
  const valorCota   = totalCotas > 0 && totalPremio > 0 ? totalPremio / totalCotas : 0

  // Rateio por participante
  const rateio = useMemo(() => {
    if (valorCota === 0) return []
    const map = new Map<string, { cotas: number; valor: number }>()
    const seen = new Set<string>()
    for (const j of jogosConferidos) {
      // Não contar duplicatas (sorteio 1 e 2 do mesmo jogo)
      const key = `${j.participante}__${j.sequencia}`
      if (seen.has(key)) continue
      seen.add(key)
      const atual = map.get(j.participante) || { cotas: 0, valor: 0 }
      map.set(j.participante, { cotas: atual.cotas + 1, valor: atual.valor + valorCota })
    }
    return [...map.entries()]
      .map(([nome, d]) => ({ nome, ...d }))
      .sort((a, b) => b.valor - a.valor)
  }, [jogosConferidos, valorCota])

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Conferência de Resultados</h1>
          <p className="text-gray-500 mt-1 text-sm">Confira os jogos do bolão contra o resultado oficial</p>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={executarConferencia} loading={executando} size="sm">
            <Play className="h-4 w-4" />
            Executar Conferência
          </Button>
        )}
      </div>

      {/* Card de busca */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-5 w-5 text-blue-700" />
            Buscar e Conferir
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {modalidadesDisponiveis.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum bolão aberto no momento.</p>
          ) : (
            <>
              {modalidadesDisponiveis.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {modalidadesDisponiveis.map(m => (
                    <button
                      key={m.value}
                      onClick={() => { setModalidade(m.value as Modalidade); setResultado(null); setJogosConferidos([]) }}
                      className="px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all"
                      style={modalidade === m.value
                        ? { borderColor: m.cor, background: m.cor, color: '#fff' }
                        : { borderColor: '#e5e7eb', background: '#fff', color: '#4b5563' }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
              <Button
                onClick={buscarResultado}
                loading={loading}
                disabled={!modalidade}
                className="w-full sm:w-auto"
                style={{ background: cor, borderColor: cor }}
              >
                <RefreshCw className="h-4 w-4" />
                Conferir{modalidadesDisponiveis.length === 1 ? ` — ${modalidadesDisponiveis[0].label}` : ''}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Resultado */}
      {resultado && (
        <div className="rounded-2xl overflow-hidden shadow-sm" style={{ border: `1.5px solid ${cor}30` }}>

          {/* Banner */}
          <div className="px-5 py-4 flex items-center justify-between gap-3" style={{ background: cor }}>
            <div className="flex items-center gap-2.5">
              <FaClover className="text-2xl shrink-0" style={{ color: 'rgba(255,255,255,0.85)' }} />
              <div>
                <h2 className="text-white text-xl font-black leading-none">{metaAtual?.label}</h2>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  {new Date(resultado.dataApuracao + 'T12:00:00').toLocaleDateString('pt-BR', {
                    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
                  })}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.6)' }}>Concurso</p>
              <p className="text-white font-black text-3xl leading-none">#{resultado.numero}</p>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-5 bg-white">

            {/* Dezenas sorteadas */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                {dezenas2.length > 0 ? 'Sorteio 1' : 'Dezenas Sorteadas'}
              </p>
              <div className="flex flex-wrap gap-2">
                {dezenas1.map((n, i) => (
                  <div key={i} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-sm text-white shrink-0" style={{ background: cor }}>
                    {pad2(n)}
                  </div>
                ))}
              </div>
              {dezenas2.length > 0 && (
                <>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 mt-4">Sorteio 2</p>
                  <div className="flex flex-wrap gap-2">
                    {dezenas2.map((n, i) => (
                      <div key={i} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-sm text-white shrink-0" style={{ background: cor }}>
                        {pad2(n)}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Premiações da Caixa — sempre exibe quando há dados */}
            {resultado.listaRateioPremio && resultado.listaRateioPremio.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Premiações Oficiais</p>
                <div className="space-y-1.5">
                  {resultado.listaRateioPremio.map((p, i) => {
                      const cidade = p.municipioUF || (i === 0 && resultado.municipioUF) || null
                      return (
                        <div key={i} className="rounded-xl px-3 py-2.5" style={{ background: `${cor}0a`, border: `1px solid ${cor}20` }}>
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Trophy className="h-3.5 w-3.5 shrink-0" style={{ color: cor }} />
                              <span className="font-semibold text-gray-800 text-sm">{formatarFaixa(p)}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="font-bold" style={{ color: cor }}>
                                {p.numeroDeGanhadores} ganhador{p.numeroDeGanhadores !== 1 ? 'es' : ''}
                              </span>
                              {p.valorPremio > 0 && (
                                <span className="font-black text-green-700">
                                  {p.valorPremio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              )}
                            </div>
                          </div>
                          {cidade && <p className="text-xs text-gray-400 mt-1 ml-5">📍 {cidade}</p>}
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {/* Resultado do bolão */}
            {jogosConferidos.length > 0 && (
              <>
                {/* Chips de resumo */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Resultado do Bolão</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Total de Jogos', value: String(totalCotas),        bg: `${cor}0d`,            color: cor       },
                      { label: 'Ganhadores',     value: String(ganhadores.length), bg: 'rgba(22,163,74,0.1)', color: '#16a34a' },
                      ...(totalPremio > 0 ? [{
                        label: 'Prêmio do Bolão',
                        value: totalPremio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                        bg: 'rgba(22,163,74,0.1)', color: '#16a34a',
                      }] : []),
                    ].map(s => (
                      <div key={s.label} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ background: s.bg }}>
                        <span className="text-gray-500 text-xs">{s.label}</span>
                        <span className="font-black" style={{ color: s.color }}>{s.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Aviso quando não houve prêmio */}
                  {ganhadores.length === 0 && (
                    <div className="mt-3 flex items-center gap-2.5 rounded-xl px-4 py-3 bg-gray-50 border border-gray-200">
                      <span className="text-xl shrink-0">😔</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Nenhum prêmio neste concurso</p>
                        <p className="text-xs text-gray-400 mt-0.5">Nenhum jogo do bolão atingiu o mínimo de acertos para premiação.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Rateio */}
                {rateio.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Rateio do Prêmio</p>
                    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${cor}25` }}>
                      <div className="px-3 py-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide" style={{ background: `${cor}12`, color: cor }}>
                        <span>Participante</span>
                        <div className="flex gap-6">
                          <span>Cotas</span>
                          <span>A receber</span>
                        </div>
                      </div>
                      {rateio.map((r, i) => (
                        <div key={r.nome} className={`px-3 py-2.5 flex items-center justify-between text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <span className="font-semibold text-gray-900 truncate flex-1 mr-4">{r.nome}</span>
                          <div className="flex gap-6 shrink-0 text-right">
                            <span className="w-10 font-mono font-bold text-center" style={{ color: cor }}>{r.cotas}</span>
                            <span className="w-24 font-black text-green-700">{r.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                          </div>
                        </div>
                      ))}
                      <div className="px-3 py-2 flex items-center justify-between text-xs" style={{ background: `${cor}08` }}>
                        <span className="text-gray-500">{totalCotas} cotas · valor por cota</span>
                        <span className="font-bold text-gray-700">{valorCota.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Jogos conferidos */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Jogos Conferidos</p>
                  <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                    {jogosConferidos.map(j => {
                      const isGanhador = j.ganhou
                      const bgCard     = isGanhador ? 'rgba(22,163,74,0.06)' : 'rgba(0,0,0,0.02)'
                      const borderCard = isGanhador ? '#16a34a40' : '#e5e7eb'
                      const badgeBg    = isGanhador ? '#16a34a' : '#9ca3af'
                      return (
                        <div key={j.id} className="rounded-xl px-3 py-2.5" style={{ background: bgCard, border: `1px solid ${borderCard}` }}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded shrink-0" style={{ background: `${cor}18`, color: cor }}>
                              #{j.sequencia}
                            </span>
                            {j.sorteio && (
                              <span className="text-xs text-gray-400 shrink-0">{j.sorteio}</span>
                            )}
                            <span className="font-semibold text-gray-900 text-sm flex-1 truncate">{j.participante}</span>
                            <span className="shrink-0 font-black text-sm px-3 py-0.5 rounded-full text-white" style={{ background: badgeBg }}>
                              {j.acertos} {j.acertos === 1 ? 'Acerto' : 'Acertos'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {j.numeros.map((n, i) => {
                              const acertou = j.dezenasSorteio.includes(n)
                              return (
                                <span
                                  key={i}
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                  style={acertou
                                    ? { background: cor, color: '#fff' }
                                    : { background: 'rgba(0,0,0,0.06)', color: '#9ca3af' }}
                                >
                                  {pad2(n)}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            {jogosConferidos.length === 0 && !loading && (
              <p className="text-sm text-gray-400 text-center py-2">
                Nenhum jogo registrado no bolão ativo desta modalidade.
              </p>
            )}
          </div>
        </div>
      )}

      {isAdmin && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-yellow-800">Sobre a Conferência Automática</p>
              <p className="text-yellow-700 mt-0.5">
                O botão &quot;Executar Conferência&quot; roda o processo completo no servidor Express:
                busca resultados, confere apostas do banco e envia notificações ao WhatsApp.
                Certifique-se de que o servidor está rodando.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

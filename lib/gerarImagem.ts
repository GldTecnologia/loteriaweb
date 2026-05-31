import { createCanvas, CanvasRenderingContext2D } from 'canvas'

// ── Paleta por modalidade ────────────────────────────────────────────────────
const PALETA: Record<string, { g1: string; g2: string; solid: string; light: string; badge: string }> = {
  'Mega-Sena':  { g1: '#005229', g2: '#00A651', solid: '#00A651', light: '#e6f7ee', badge: '#d0f0df' },
  'Lotofácil':  { g1: '#4a0f78', g2: '#91278F', solid: '#91278F', light: '#f5e8f5', badge: '#ead0ea' },
  'Quina':      { g1: '#1c1e5e', g2: '#2E3192', solid: '#2E3192', light: '#e8e9f5', badge: '#d0d2ea' },
  'Dupla Sena': { g1: '#6b1529', g2: '#A62B43', solid: '#A62B43', light: '#f5e8eb', badge: '#ead0d5' },
}
const PAL_DEFAULT = { g1: '#0f172a', g2: '#1e3a8a', solid: '#1e3a8a', light: '#eff6ff', badge: '#dde8ff' }
const getP = (m: string) => PALETA[m] ?? PAL_DEFAULT

// ── Helpers ──────────────────────────────────────────────────────────────────
type Ctx = CanvasRenderingContext2D

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function fillRR(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string) {
  rr(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill()
}

function strokeRR(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, stroke: string, lw = 1) {
  rr(ctx, x, y, w, h, r); ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke()
}

function dot(ctx: Ctx, cx: number, cy: number, r: number, fill: string) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = fill; ctx.fill()
}

function shadow(ctx: Ctx, blur = 12, color = 'rgba(0,0,0,0.10)') {
  ctx.shadowBlur = blur; ctx.shadowColor = color
}
function noShadow(ctx: Ctx) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent' }

function hGrad(ctx: Ctx, x: number, w: number, c1: string, c2: string) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0)
  g.addColorStop(0, c1); g.addColorStop(1, c2); return g
}

function vGrad(ctx: Ctx, y: number, h: number, c1: string, c2: string) {
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, c1); g.addColorStop(1, c2); return g
}

const W       = 720
const PAD     = 28
const BRANCO  = '#ffffff'
const CINZA_B = '#f4f6f8'
const CINZA_T = '#6b7280'
const ESCURO  = '#111827'
const BORDA   = '#e5e7eb'
const LARANJA = '#f59e0b'
const fmtBRL  = (v: unknown) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0))

// ── Interfaces ───────────────────────────────────────────────────────────────
interface Aposta {
  seq: number; idx: number; nome: string; nums: number[]
  acertos: number; premiado: boolean; apostador?: string; participante?: string
}
interface Premio { descricaoFaixa: string; numeroDeGanhadores: number; valorPremio: number }
interface Ganhador { municipio: string; uf: string; ganhadores: number }
interface ResultadoParams {
  nomeGrupo: string; modalidade: string; concurso: number; data: string
  numeros: number[]; numeros2?: number[] | null
  premioDia: string; acumuladoAntes: string; acumuladoAtualizado: string
  apostas: Aposta[]; premios: Premio[]; ganhadores: Ganhador[]
  acumulado: boolean; valorEstimadoProximo: number
  proximoConcurso?: number | null; dataProximoConcurso?: string | null
  parte?: number; totalPartes?: number; totalApostas?: number
}

// ── IMAGEM DE RESULTADO ──────────────────────────────────────────────────────
export async function gerarImagemResultado(params: ResultadoParams): Promise<Buffer> {
  const {
    nomeGrupo, modalidade, concurso, data, numeros, numeros2 = [], premioDia,
    acumuladoAntes, acumuladoAtualizado, apostas, premios = [], ganhadores = [],
    acumulado = false, valorEstimadoProximo = 0, proximoConcurso, dataProximoConcurso,
    parte, totalPartes,
  } = params

  const p = getP(modalidade)
  const todos = [...numeros, ...(numeros2 || [])]
  const numLinhas = Math.ceil(todos.length / 8)

  const H_HEADER  = 130
  const H_NUMS    = 50 + numLinhas * 58 + 16
  const H_STATS   = 110
  const H_ACUM    = acumulado ? 80 : 0
  const H_PREMIO  = premios.length  > 0 ? 44 + premios.length  * 30 : 0
  const H_GANH    = ganhadores.length > 0 ? 44 + ganhadores.length * 32 : 0
  const H_APOSTAS = apostas.length * 128 + (apostas.length > 0 ? 40 : 0)
  const H_FOOTER  = 48
  const H = H_HEADER + H_NUMS + H_STATS + H_ACUM + H_PREMIO + H_GANH + H_APOSTAS + H_FOOTER + 24

  const canvas = createCanvas(W, H)
  const ctx    = canvas.getContext('2d') as Ctx

  // fundo geral
  ctx.fillStyle = '#f0f2f5'; ctx.fillRect(0, 0, W, H)

  // ── HEADER ─────────────────────────────────────────────────────
  ctx.fillStyle = hGrad(ctx, 0, W, p.g1, p.g2)
  ctx.fillRect(0, 0, W, H_HEADER)

  // badge modalidade
  const badgeX = PAD
  ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'
  const badgeTxt = modalidade.toUpperCase()
  const badgeW = ctx.measureText(badgeTxt).width + 20
  fillRR(ctx, badgeX, 20, badgeW, 22, 11, 'rgba(255,255,255,0.20)')
  ctx.fillStyle = BRANCO; ctx.fillText(badgeTxt, badgeX + 10, 35)

  // parte (se dividido em chunks)
  if (parte && totalPartes && totalPartes > 1) {
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'right'
    fillRR(ctx, W - PAD - 80, 20, 80, 22, 11, 'rgba(255,255,255,0.20)')
    ctx.fillStyle = BRANCO; ctx.fillText(`${parte}/${totalPartes}`, W - PAD - 5, 35)
  }

  ctx.fillStyle = BRANCO; ctx.textAlign = 'center'
  ctx.font = 'bold 30px sans-serif'
  ctx.fillText(nomeGrupo, W / 2, 75)
  ctx.font = '15px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fillText(`Concurso ${concurso}  ·  ${data}`, W / 2, 100)
  if (proximoConcurso) {
    ctx.font = '13px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillText(`Próximo: #${proximoConcurso}${dataProximoConcurso ? '  ·  ' + dataProximoConcurso : ''}`, W / 2, 120)
  }

  let y = H_HEADER + 16

  // ── NÚMEROS SORTEADOS ───────────────────────────────────────────
  shadow(ctx, 8)
  fillRR(ctx, PAD, y, W - PAD * 2, H_NUMS - 16, 16, BRANCO)
  noShadow(ctx)

  ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = CINZA_T; ctx.textAlign = 'center'
  ctx.fillText('NÚMEROS SORTEADOS', W / 2, y + 22)

  const bR   = 24
  const cols = 8
  const bGap = Math.floor((W - PAD * 2 - 32) / Math.min(cols, todos.length))
  const bX0  = PAD + 16 + bR

  todos.forEach((n, i) => {
    const col = i % cols; const row = Math.floor(i / cols)
    const cx  = bX0 + col * bGap; const cy = y + 40 + row * 58

    // sombra suave na bolinha
    shadow(ctx, 6, 'rgba(0,0,0,0.18)')
    // bolinha com gradiente radial
    dot(ctx, cx, cy, bR, p.solid)
    noShadow(ctx)
    const rg = ctx.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, bR)
    rg.addColorStop(0, lighten(p.solid, 40)); rg.addColorStop(1, p.solid)
    ctx.beginPath(); ctx.arc(cx, cy, bR, 0, Math.PI * 2)
    ctx.fillStyle = rg; ctx.fill()

    ctx.fillStyle = BRANCO; ctx.font = `bold ${bR > 20 ? 16 : 14}px monospace`
    ctx.textAlign = 'center'; ctx.fillText(String(n).padStart(2, '0'), cx, cy + 6)
  })

  y += H_NUMS

  // ── STATS ───────────────────────────────────────────────────────
  const sW = (W - PAD * 2 - 16) / 3; const sGap = 8
  const statY = y

  const stats = [
    { label: 'PRÊMIO DO DIA',   val: premioDia,          cor: p.solid,   bg: p.light },
    { label: 'ACUMULADO ANTES', val: acumuladoAntes,     cor: '#b45309', bg: '#fef9c3' },
    { label: 'NOVO ACUMULADO',  val: acumuladoAtualizado,cor: p.solid,   bg: p.badge },
  ]

  stats.forEach((s, i) => {
    const sx = PAD + i * (sW + sGap)
    shadow(ctx, 6)
    fillRR(ctx, sx, statY, sW, H_STATS - 12, 14, BRANCO)
    noShadow(ctx)
    fillRR(ctx, sx, statY, sW, 4, 4, s.cor)

    ctx.fillStyle = CINZA_T; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(s.label, sx + sW / 2, statY + 24)
    ctx.fillStyle = s.cor; ctx.font = `bold ${s.val.length > 10 ? 16 : 18}px monospace`
    ctx.fillText(s.val, sx + sW / 2, statY + 58)
    ctx.fillStyle = CINZA_T; ctx.font = '10px sans-serif'
    ctx.fillText(i === 1 ? 'total anterior' : i === 2 ? 'atualizado' : 'este concurso', sx + sW / 2, statY + 76)
  })

  y += H_STATS

  // ── ACUMULADO banner ────────────────────────────────────────────
  if (acumulado) {
    shadow(ctx, 8, 'rgba(180,100,0,0.15)')
    fillRR(ctx, PAD, y, W - PAD * 2, 70, 14, '#fffbeb')
    noShadow(ctx)
    ctx.fillStyle = '#92400e'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('🏆 Prêmio Acumulado!', W / 2, y + 28)
    ctx.fillStyle = '#b45309'; ctx.font = '13px sans-serif'
    ctx.fillText('Nenhum ganhador na faixa principal' + (valorEstimadoProximo > 0 ? `  ·  Próximo est. ${fmtBRL(valorEstimadoProximo)}` : ''), W / 2, y + 50)
    y += 80
  }

  // ── PREMIAÇÃO ───────────────────────────────────────────────────
  if (premios.length > 0) {
    y += 8
    shadow(ctx, 8)
    fillRR(ctx, PAD, y, W - PAD * 2, H_PREMIO - 8, 14, BRANCO)
    noShadow(ctx)

    ctx.fillStyle = ESCURO; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left'
    ctx.fillText('Premiação por faixa', PAD + 16, y + 24)
    ctx.fillStyle = BORDA; ctx.fillRect(PAD + 16, y + 32, W - PAD * 2 - 32, 1)

    premios.forEach((pr, i) => {
      const py = y + 44 + i * 30
      const isFx1 = i === 0
      if (isFx1 && !acumulado) fillRR(ctx, PAD + 8, py - 10, W - PAD * 2 - 16, 28, 6, p.light)
      ctx.fillStyle = isFx1 ? p.solid : CINZA_T
      ctx.font = `${isFx1 ? 'bold' : 'normal'} 13px sans-serif`; ctx.textAlign = 'left'
      ctx.fillText(pr.descricaoFaixa || '', PAD + 16, py + 8)
      ctx.textAlign = 'center'; ctx.fillText((pr.numeroDeGanhadores || 0).toLocaleString('pt-BR'), W / 2 + 60, py + 8)
      ctx.font = `${isFx1 ? 'bold' : 'normal'} 13px monospace`; ctx.textAlign = 'right'
      ctx.fillStyle = isFx1 && acumulado ? '#b45309' : isFx1 ? p.solid : CINZA_T
      ctx.fillText(isFx1 && acumulado ? 'Acumulado' : fmtBRL(pr.valorPremio), W - PAD - 16, py + 8)
      if (i < premios.length - 1) { ctx.fillStyle = BORDA; ctx.fillRect(PAD + 16, py + 18, W - PAD * 2 - 32, 1) }
    })
    y += H_PREMIO
  }

  // ── GANHADORES ──────────────────────────────────────────────────
  if (ganhadores.length > 0 && !acumulado) {
    y += 8
    shadow(ctx, 8)
    fillRR(ctx, PAD, y, W - PAD * 2, H_GANH - 8, 14, BRANCO)
    noShadow(ctx)

    ctx.fillStyle = ESCURO; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left'
    ctx.fillText('Ganhadores', PAD + 16, y + 24)
    ctx.fillStyle = BORDA; ctx.fillRect(PAD + 16, y + 32, W - PAD * 2 - 32, 1)

    ganhadores.forEach((g, i) => {
      const gy = y + 44 + i * 32
      fillRR(ctx, PAD + 8, gy - 8, W - PAD * 2 - 16, 26, 6, p.light)
      ctx.fillStyle = p.solid; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left'
      ctx.fillText(`${g.municipio} · ${g.uf}`, PAD + 16, gy + 8)
      ctx.textAlign = 'right'; ctx.fillText(String(g.ganhadores || 1), W - PAD - 16, gy + 8)
    })
    y += H_GANH
  }

  // ── APOSTAS ─────────────────────────────────────────────────────
  if (apostas.length > 0) {
    y += 12
    ctx.fillStyle = CINZA_T; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'
    ctx.fillText(`APOSTAS  (${apostas.length})`, PAD, y + 4)
    y += 18

    for (const ap of apostas) {
      const nome = (ap.nome || ap.apostador || ap.participante || '').trim()
      const seq  = ap.seq || (ap.idx + 1) || 1
      const sorteados = [...numeros, ...(numeros2 || [])]

      shadow(ctx, 10, 'rgba(0,0,0,0.08)')
      fillRR(ctx, PAD, y, W - PAD * 2, 118, 16, BRANCO)
      noShadow(ctx)

      // topo colorido fino
      fillRR(ctx, PAD, y, W - PAD * 2, 5, 16, ap.premiado ? p.solid : '#e5e7eb')
      fillRR(ctx, PAD, y + 2, W - PAD * 2, 3, 0, ap.premiado ? p.solid : '#e5e7eb')

      // número da aposta
      ctx.fillStyle = ap.premiado ? p.solid : '#9ca3af'
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'
      ctx.fillText(`#${String(seq).padStart(2, '0')}`, PAD + 16, y + 24)

      // nome
      if (nome) {
        ctx.fillStyle = ESCURO; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left'
        ctx.fillText(nome, PAD + 40, y + 24)
      }

      // badge acertos
      const badgeColor = ap.acertos === 0 ? '#6b7280' : ap.premiado ? p.solid : LARANJA
      const badgeTxt2  = ap.acertos === 0 ? '0 acertos' : `${ap.acertos} acertos${ap.premiado ? ' 🏆' : ''}`
      ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'right'
      const bw2 = ctx.measureText(badgeTxt2).width + 20
      fillRR(ctx, W - PAD - 16 - bw2, y + 12, bw2, 22, 11, badgeColor)
      ctx.fillStyle = BRANCO; ctx.fillText(badgeTxt2, W - PAD - 16, y + 27)

      // bolinhas
      const maxW  = W - PAD * 2 - 32
      const apR   = Math.min(19, Math.floor((maxW / ap.nums.length - 3) / 2))
      const apGap = Math.floor(maxW / ap.nums.length)
      const apX0  = PAD + 16 + apR
      const apY   = y + 58

      ap.nums.forEach((n, i) => {
        const cx = apX0 + i * apGap; const hit = sorteados.includes(n)
        if (hit) {
          dot(ctx, cx, apY, apR, p.solid)
          const rg2 = ctx.createRadialGradient(cx - 4, apY - 4, 2, cx, apY, apR)
          rg2.addColorStop(0, lighten(p.solid, 30)); rg2.addColorStop(1, p.solid)
          ctx.beginPath(); ctx.arc(cx, apY, apR, 0, Math.PI * 2)
          ctx.fillStyle = rg2; ctx.fill()
        } else {
          dot(ctx, cx, apY, apR, '#e5e7eb')
        }
        ctx.fillStyle = hit ? BRANCO : '#9ca3af'
        ctx.font = `bold ${Math.max(10, apR - 5)}px monospace`; ctx.textAlign = 'center'
        ctx.fillText(String(n).padStart(2, '0'), cx, apY + Math.floor(apR * 0.38))
      })

      y += 128
    }
  }

  // ── RODAPÉ ──────────────────────────────────────────────────────
  y += 8
  ctx.fillStyle = CINZA_T; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'
  ctx.fillText('loterias.gldtecnologia.com.br  ·  Resultado gerado automaticamente', W / 2, y + 20)

  return canvas.toBuffer('image/png')
}

// ── IMAGEM DE RENOVAÇÃO ──────────────────────────────────────────────────────
interface RenovacaoParams {
  nomeGrupo: string; modalidade: string; valorRenov: string; acumulado: string
  valorPagar: string; valorRateio: string; temCobranca: boolean; pixQrBuffer: Buffer | null
}

export async function gerarImagemRenovacao(params: RenovacaoParams): Promise<Buffer> {
  const { nomeGrupo, modalidade, valorRenov, acumulado, valorPagar, valorRateio, temCobranca, pixQrBuffer } = params
  const p  = getP(modalidade)
  const W2 = 720; const H = temCobranca ? 940 : 580
  const canvas = createCanvas(W2, H); const ctx = canvas.getContext('2d') as Ctx

  ctx.fillStyle = '#f0f2f5'; ctx.fillRect(0, 0, W2, H)

  // header
  ctx.fillStyle = hGrad(ctx, 0, W2, p.g1, p.g2); ctx.fillRect(0, 0, W2, 120)
  ctx.fillStyle = BRANCO; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'
  ctx.fillText('🔄 Renovação', W2 / 2, 56)
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '16px sans-serif'
  ctx.fillText(`${nomeGrupo}  ·  ${modalidade}`, W2 / 2, 88)

  let y = 136

  // cards
  const cW = (W2 - 56 - 16) / 3; const cGap = 8
  const cards = [
    { label: 'VALOR TOTAL',    val: valorRenov,  cor: p.solid,   bg: p.light },
    { label: 'PRÊMIOS ACUM.',  val: acumulado,   cor: '#b45309', bg: '#fef9c3' },
    { label: 'A PAGAR',        val: valorPagar,  cor: temCobranca ? '#dc2626' : p.solid, bg: temCobranca ? '#fee2e2' : p.light },
  ]
  cards.forEach((c2, i) => {
    const cx = 28 + i * (cW + cGap)
    shadow(ctx, 8)
    fillRR(ctx, cx, y, cW, 110, 14, BRANCO)
    noShadow(ctx)
    fillRR(ctx, cx, y, cW, 4, 4, c2.cor)
    ctx.fillStyle = CINZA_T; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(c2.label, cx + cW / 2, y + 28)
    ctx.fillStyle = c2.cor; ctx.font = `bold ${c2.val.length > 9 ? 15 : 18}px monospace`
    ctx.fillText(c2.val, cx + cW / 2, y + 65)
  })

  y += 130

  if (temCobranca) {
    // destaque por participante
    shadow(ctx, 12, 'rgba(0,0,0,0.12)')
    ctx.fillStyle = hGrad(ctx, 28, W2 - 56, p.g1, p.g2)
    rr(ctx, 28, y, W2 - 56, 88, 16); ctx.fill()
    noShadow(ctx)
    ctx.fillStyle = 'rgba(255,255,255,0.70)'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('VALOR POR PARTICIPANTE', W2 / 2, y + 28)
    ctx.fillStyle = BRANCO; ctx.font = 'bold 38px monospace'
    ctx.fillText(valorRateio, W2 / 2, y + 70)
    y += 108

    // QR Pix
    ctx.fillStyle = CINZA_T; ctx.font = 'bold 12px sans-serif'
    ctx.fillText('PAGAMENTO VIA PIX', W2 / 2, y + 24); y += 40

    shadow(ctx, 8)
    fillRR(ctx, 28, y, W2 - 56, pixQrBuffer ? 320 : 60, 16, BRANCO)
    noShadow(ctx)

    if (pixQrBuffer) {
      const { loadImage } = await import('canvas')
      const img = await loadImage(pixQrBuffer)
      const sz  = 260; const qx = (W2 - sz) / 2
      ctx.drawImage(img, qx, y + 20, sz, sz)
      ctx.fillStyle = CINZA_T; ctx.font = '12px sans-serif'
      ctx.fillText('Escaneie para pagar', W2 / 2, y + sz + 40)
      y += 320
    } else {
      ctx.fillStyle = CINZA_T; ctx.font = '13px sans-serif'
      ctx.fillText('QR Code PIX não disponível', W2 / 2, y + 36); y += 60
    }
  } else {
    shadow(ctx, 8)
    fillRR(ctx, 28, y, W2 - 56, 100, 16, p.light)
    noShadow(ctx)
    strokeRR(ctx, 28, y, W2 - 56, 100, 16, p.solid, 2)
    ctx.fillStyle = p.solid; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('🎉 Sem cobrança nesta rodada!', W2 / 2, y + 42)
    ctx.fillStyle = p.g1; ctx.font = '15px sans-serif'
    ctx.fillText('Os prêmios cobriram todos os custos.', W2 / 2, y + 72)
    y += 120
  }

  y += 12
  ctx.fillStyle = CINZA_T; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'
  ctx.fillText('loterias.gldtecnologia.com.br  ·  Bolão da Sorte', W2 / 2, y + 20)

  return canvas.toBuffer('image/png')
}

// ── Utilitário: clareia uma cor hex ──────────────────────────────────────────
function lighten(hex: string, pct: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, (n >> 16) + pct)
  const g = Math.min(255, ((n >> 8) & 0xff) + pct)
  const b = Math.min(255, (n & 0xff) + pct)
  return `rgb(${r},${g},${b})`
}

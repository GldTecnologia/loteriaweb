import { createCanvas } from 'canvas'

const COR_VERDE       = '#1a5c38'
const COR_VERDE_CLARO = '#f0faf4'
const COR_VERDE_MED   = '#e6f4ea'
const COR_LARANJA     = '#f0a500'
const COR_CINZA_CLR   = '#e5e5e5'
const COR_AMARELO     = '#fff8e6'
const COR_AMARELO_T   = '#c97d00'
const COR_BRANCO      = '#ffffff'
const COR_TEXTO       = '#222222'
const COR_TEXTO_DIM   = '#888888'
const COR_BORDA       = '#eeeeee'
const COR_VERDE_SUAVE = '#a8d5b5'

type Ctx = ReturnType<ReturnType<typeof createCanvas>['getContext']>

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill?: string) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  if (fill) { ctx.fillStyle = fill; ctx.fill() }
}

function circle(ctx: Ctx, cx: number, cy: number, r: number, fill: string) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
}

interface Aposta {
  seq: number
  idx: number
  nome: string
  nums: number[]
  acertos: number
  premiado: boolean
  apostador?: string
  participante?: string
}

interface Premio {
  descricaoFaixa: string
  numeroDeGanhadores: number
  valorPremio: number
}

interface Ganhador {
  municipio: string
  uf: string
  ganhadores: number
}

interface ResultadoParams {
  nomeGrupo: string
  modalidade: string
  concurso: number
  data: string
  numeros: number[]
  numeros2?: number[] | null
  premioDia: string
  acumuladoAntes: string
  acumuladoAtualizado: string
  apostas: Aposta[]
  premios: Premio[]
  ganhadores: Ganhador[]
  acumulado: boolean
  valorEstimadoProximo: number
  proximoConcurso?: number | null
  dataProximoConcurso?: string | null
}

export async function gerarImagemResultado(params: ResultadoParams): Promise<Buffer> {
  const {
    nomeGrupo, modalidade, concurso, data, numeros, numeros2, premioDia,
    acumuladoAntes, acumuladoAtualizado, apostas, premios = [], ganhadores = [],
    acumulado = false, valorEstimadoProximo = 0, proximoConcurso, dataProximoConcurso,
  } = params

  const W         = 720
  const H_PREMIOS = premios.length > 0 ? 30 + premios.length * 28 + 16 : 0
  const H_GANHS   = ganhadores.length > 0 ? 30 + ganhadores.length * 32 + 16 : 0
  const H_ACUM    = acumulado ? 80 : 0
  const H_AP      = apostas.length * 120
  const H         = 440 + H_PREMIOS + H_GANHS + H_ACUM + H_AP

  const canvas = createCanvas(W, H)
  const ctx    = canvas.getContext('2d')

  roundRect(ctx, 0, 0, W, H, 24, COR_BRANCO)
  roundRect(ctx, 0, 0, W, 110, 24, COR_VERDE)
  ctx.fillStyle = COR_VERDE
  ctx.fillRect(0, 86, W, 24)

  ctx.fillStyle = COR_BRANCO
  ctx.font      = 'bold 32px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(nomeGrupo, W / 2, 46)

  ctx.fillStyle = COR_VERDE_SUAVE
  ctx.font      = '18px sans-serif'
  ctx.fillText(`Conferência ${modalidade} · Concurso ${concurso} · ${data}`, W / 2, 72)
  if (proximoConcurso) {
    ctx.fillStyle = '#7ac498'
    ctx.font      = '14px sans-serif'
    ctx.fillText(`Próximo: Concurso ${proximoConcurso}${dataProximoConcurso ? ' · ' + dataProximoConcurso : ''}`, W / 2, 90)
  }

  ctx.fillStyle = COR_TEXTO_DIM
  ctx.font      = '13px sans-serif'
  ctx.fillText('NÚMEROS SORTEADOS', W / 2, 128)

  const todosNums = [...numeros, ...(numeros2 || [])]
  const cols = 8
  const bR   = 26
  const bGap = 80
  const startX = (W - (Math.min(cols, todosNums.length) * bGap)) / 2 + bGap / 2

  todosNums.forEach((n, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cx  = startX + col * bGap
    const cy  = 162 + row * 58
    circle(ctx, cx, cy, bR, COR_VERDE)
    ctx.fillStyle = COR_BRANCO
    ctx.font      = 'bold 18px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(String(n).padStart(2, '0'), cx, cy + 6)
  })

  const numRows = Math.ceil(todosNums.length / cols)
  let y = 162 + numRows * 58 + 10

  ctx.fillStyle = COR_BORDA
  ctx.fillRect(40, y, W - 80, 1)
  y += 16

  const cW = 200, cH = 90, cGap = 20
  const cTotalW = cW * 3 + cGap * 2
  const cX = (W - cTotalW) / 2

  const fmtBRL = (v: string | number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0))

  roundRect(ctx, cX, y, cW, cH, 14, COR_VERDE_CLARO)
  ctx.fillStyle = COR_TEXTO_DIM; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'
  ctx.fillText('PRÊMIO DO DIA', cX + cW / 2, y + 22)
  ctx.fillStyle = COR_VERDE; ctx.font = 'bold 22px monospace'
  ctx.fillText(premioDia, cX + cW / 2, y + 52)

  roundRect(ctx, cX + cW + cGap, y, cW, cH, 14, COR_AMARELO)
  ctx.fillStyle = COR_TEXTO_DIM; ctx.font = '11px sans-serif'
  ctx.fillText('ACUMULADO', cX + cW + cGap + cW / 2, y + 22)
  ctx.fillStyle = COR_AMARELO_T; ctx.font = 'bold 22px monospace'
  ctx.fillText(acumuladoAntes, cX + cW + cGap + cW / 2, y + 52)

  roundRect(ctx, cX + (cW + cGap) * 2, y, cW, cH, 14, COR_VERDE_MED)
  ctx.fillStyle = COR_TEXTO_DIM; ctx.font = '11px sans-serif'
  ctx.fillText('ATUALIZADO', cX + (cW + cGap) * 2 + cW / 2, y + 22)
  ctx.fillStyle = COR_VERDE; ctx.font = 'bold 22px monospace'
  ctx.fillText(acumuladoAtualizado, cX + (cW + cGap) * 2 + cW / 2, y + 52)

  y += cH + 20

  if (acumulado) {
    ctx.fillStyle = COR_BORDA; ctx.fillRect(40, y, W - 80, 1); y += 14
    roundRect(ctx, 40, y, W - 80, 70, 12, '#faeeda')
    ctx.fillStyle = '#854f0b'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('Prêmio Acumulado!', W / 2, y + 28)
    ctx.fillStyle = '#633806'; ctx.font = '15px sans-serif'
    ctx.fillText('Nenhum ganhador na faixa principal', W / 2, y + 50)
    if (valorEstimadoProximo > 0) {
      ctx.fillStyle = '#854f0b'; ctx.font = 'bold 14px monospace'
      ctx.fillText(`Estimativa próximo: ${fmtBRL(valorEstimadoProximo)}`, W / 2, y + 68)
    }
    y += 86
  }

  if (premios.length > 0) {
    ctx.fillStyle = COR_BORDA; ctx.fillRect(40, y, W - 80, 1); y += 16
    ctx.fillStyle = COR_TEXTO; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'left'
    ctx.fillText('Premiação', 44, y + 16)
    ctx.fillStyle = COR_TEXTO_DIM; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('Ganhadores', W / 2 + 60, y + 16)
    ctx.textAlign = 'right'
    ctx.fillText('Valor', W - 44, y + 16)
    ctx.fillStyle = '#dddddd'; ctx.fillRect(40, y + 20, W - 80, 1)
    y += 26

    premios.forEach((p, i) => {
      const isFaixa1 = i === 0
      const isAcum   = isFaixa1 && acumulado
      const bgColor  = isFaixa1 ? (acumulado ? '#faeeda' : COR_VERDE_CLARO) : (i % 2 === 0 ? '#fafafa' : COR_BRANCO)
      roundRect(ctx, 40, y, W - 80, 28, 6, bgColor)
      const qtd = (p.numeroDeGanhadores || 0).toLocaleString('pt-BR')
      const val = isAcum ? 'Acumulado' : fmtBRL(p.valorPremio || 0)
      const cor = isFaixa1 ? (acumulado ? '#854f0b' : COR_VERDE) : '#555555'
      const fw  = isFaixa1 ? 'bold' : 'normal'
      ctx.fillStyle = cor; ctx.font = `${fw} 14px sans-serif`; ctx.textAlign = 'left'
      ctx.fillText(p.descricaoFaixa || '', 56, y + 18)
      ctx.textAlign = 'center'
      ctx.fillText(qtd, W / 2 + 60, y + 18)
      ctx.font = `${fw} 14px monospace`; ctx.textAlign = 'right'
      ctx.fillText(val, W - 44, y + 18)
      if (i < premios.length - 1) { ctx.fillStyle = '#f0f0f0'; ctx.fillRect(40, y + 28, W - 80, 1) }
      y += 28
    })
    y += 10
  }

  if (ganhadores.length > 0 && !acumulado) {
    ctx.fillStyle = COR_BORDA; ctx.fillRect(40, y, W - 80, 1); y += 16
    ctx.fillStyle = COR_TEXTO; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'left'
    ctx.fillText('Ganhadores', 44, y + 16)
    ctx.fillStyle = COR_TEXTO_DIM; ctx.font = '13px sans-serif'; ctx.textAlign = 'right'
    ctx.fillText('Qtd', W - 44, y + 16)
    ctx.fillStyle = '#dddddd'; ctx.fillRect(40, y + 20, W - 80, 1)
    y += 26
    ganhadores.forEach((g, i) => {
      roundRect(ctx, 40, y, W - 80, 30, 6, COR_VERDE_CLARO)
      ctx.fillStyle = COR_VERDE; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left'
      ctx.fillText(`${g.municipio} · ${g.uf}`, 56, y + 19)
      ctx.textAlign = 'right'
      ctx.fillText(String(g.ganhadores || 1), W - 44, y + 19)
      if (i < ganhadores.length - 1) { ctx.fillStyle = '#d0e8d8'; ctx.fillRect(40, y + 30, W - 80, 1) }
      y += 32
    })
    y += 10
  }

  ctx.fillStyle = COR_BORDA; ctx.fillRect(40, y, W - 80, 1); y += 18

  for (const ap of apostas) {
    const nomeExibir = (ap.nome || ap.apostador || ap.participante || '').trim()
    const seqExibir  = ap.seq || (ap.idx + 1) || 1
    ctx.fillStyle = COR_TEXTO; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'left'
    ctx.fillText(`Aposta ${String(seqExibir).padStart(2, '0')}`, 40, y + 16)
    if (nomeExibir) {
      ctx.fillStyle = COR_TEXTO_DIM; ctx.font = '14px sans-serif'; ctx.textAlign = 'right'
      ctx.fillText(nomeExibir, W - 40, y + 16)
    }
    const sorteados = [...(numeros || []), ...(numeros2 || [])]
    const maxW  = W - 80
    const apR   = Math.min(20, Math.floor((maxW / ap.nums.length - 4) / 2))
    const apGap = Math.floor(maxW / ap.nums.length)
    const apStartX = 40 + apR
    const apY  = y + 44

    ap.nums.forEach((n, i) => {
      const cx  = apStartX + i * apGap
      const hit = sorteados.includes(n)
      circle(ctx, cx, apY, apR, hit ? COR_VERDE : COR_CINZA_CLR)
      ctx.fillStyle = hit ? COR_BRANCO : '#aaaaaa'
      ctx.font      = `bold ${Math.max(11, apR - 6)}px monospace`
      ctx.textAlign = 'center'
      ctx.fillText(String(n).padStart(2, '0'), cx, apY + Math.floor(apR * 0.35))
    })

    const badgeColor = ap.acertos === 0 ? '#888' : ap.premiado ? COR_VERDE : COR_LARANJA
    const badgeText  = ap.acertos === 0
      ? '❌ 0 acertos'
      : ap.premiado ? `✅ ${ap.acertos} acertos — Premiado!` : `⚠️ ${ap.acertos} acertos`

    roundRect(ctx, 40, y + 74, W - 80, 32, 8, badgeColor)
    ctx.fillStyle = COR_BRANCO; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(badgeText, W / 2, y + 95)
    y += 120
    if (ap !== apostas[apostas.length - 1]) { ctx.fillStyle = COR_BORDA; ctx.fillRect(40, y - 2, W - 80, 1) }
  }

  ctx.fillStyle = COR_BORDA; ctx.fillRect(40, y + 8, W - 80, 1)
  ctx.fillStyle = '#bbbbbb'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'
  ctx.fillText('loterias.gldtecnologia.com.br · Resultado gerado automaticamente', W / 2, y + 30)

  return canvas.toBuffer('image/png')
}

interface RenovacaoParams {
  nomeGrupo: string
  modalidade: string
  valorRenov: string
  acumulado: string
  valorPagar: string
  valorRateio: string
  temCobranca: boolean
  pixQrBuffer: Buffer | null
}

export async function gerarImagemRenovacao(params: RenovacaoParams): Promise<Buffer> {
  const { nomeGrupo, modalidade, valorRenov, acumulado, valorPagar, valorRateio, temCobranca, pixQrBuffer } = params

  const W = 720
  const H = temCobranca ? 980 : 620

  const canvas = createCanvas(W, H)
  const ctx    = canvas.getContext('2d')

  roundRect(ctx, 0, 0, W, H, 24, COR_BRANCO)

  const headerColor = temCobranca ? '#1a3c6e' : COR_VERDE
  const headerSub   = temCobranca ? '#8ab4e8' : COR_VERDE_SUAVE
  roundRect(ctx, 0, 0, W, 110, 24, headerColor)
  ctx.fillStyle = headerColor; ctx.fillRect(0, 86, W, 24)
  ctx.fillStyle = COR_BRANCO; ctx.font = 'bold 32px sans-serif'; ctx.textAlign = 'center'
  ctx.fillText('Renovacao', W / 2, 46)
  ctx.fillStyle = headerSub; ctx.font = '18px sans-serif'
  ctx.fillText(`${nomeGrupo} · ${modalidade}`, W / 2, 78)

  const cW = 200, cH = 130, cGap = 20
  const cTotalW = cW * 3 + cGap * 2
  const cX = (W - cTotalW) / 2
  const cY = 130

  roundRect(ctx, cX, cY, cW, cH, 14, '#f0f4fa')
  ctx.fillStyle = COR_TEXTO_DIM; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'
  ctx.fillText('TOTAL RENOVAÇÃO', cX + cW / 2, cY + 30)
  ctx.fillStyle = '#1a3c6e'; ctx.font = 'bold 26px monospace'
  ctx.fillText(valorRenov, cX + cW / 2, cY + 72)

  roundRect(ctx, cX + cW + cGap, cY, cW, cH, 14, COR_AMARELO)
  ctx.fillStyle = COR_TEXTO_DIM; ctx.font = '13px sans-serif'
  ctx.fillText('PRÊMIOS ACUM.', cX + cW + cGap + cW / 2, cY + 30)
  ctx.fillStyle = COR_AMARELO_T; ctx.font = 'bold 26px monospace'
  ctx.fillText(acumulado, cX + cW + cGap + cW / 2, cY + 72)

  const card3Color = temCobranca ? '#fef0f0' : COR_VERDE_CLARO
  const val3Color  = temCobranca ? '#c0392b' : COR_VERDE
  roundRect(ctx, cX + (cW + cGap) * 2, cY, cW, cH, 14, card3Color)
  ctx.fillStyle = COR_TEXTO_DIM; ctx.font = '13px sans-serif'
  ctx.fillText('A PAGAR', cX + (cW + cGap) * 2 + cW / 2, cY + 30)
  ctx.fillStyle = val3Color; ctx.font = 'bold 26px monospace'
  ctx.fillText(valorPagar, cX + (cW + cGap) * 2 + cW / 2, cY + 72)

  let y = cY + cH + 24
  ctx.fillStyle = COR_BORDA; ctx.fillRect(40, y, W - 80, 1); y += 20

  if (temCobranca) {
    roundRect(ctx, 40, y, W - 80, 90, 14, '#1a3c6e')
    ctx.fillStyle = '#8ab4e8'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('VALOR POR PARTICIPANTE', W / 2, y + 30)
    ctx.fillStyle = COR_BRANCO; ctx.font = 'bold 42px monospace'
    ctx.fillText(valorRateio, W / 2, y + 72)
    y += 110
    ctx.fillStyle = COR_BORDA; ctx.fillRect(40, y, W - 80, 1); y += 20
    ctx.fillStyle = COR_TEXTO_DIM; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('PAGAMENTO VIA PIX', W / 2, y + 20)
    y += 36

    if (pixQrBuffer) {
      const { loadImage } = await import('canvas')
      const QRImg  = await loadImage(pixQrBuffer)
      const qrSize = 280
      const qrX    = (W - qrSize) / 2
      roundRect(ctx, qrX - 12, y - 12, qrSize + 24, qrSize + 24, 12, '#f8f8f8')
      ctx.drawImage(QRImg, qrX, y, qrSize, qrSize)
      y += qrSize + 30
    } else {
      roundRect(ctx, (W - 280) / 2 - 12, y - 12, 304, 304, 12, '#f8f8f8')
      ctx.fillStyle = '#cccccc'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center'
      ctx.fillText('QR Code PIX', W / 2, y + 140)
      y += 320
    }
  } else {
    roundRect(ctx, 40, y, W - 80, 130, 14, COR_VERDE_CLARO)
    ctx.fillStyle = COR_VERDE; ctx.font = 'bold 36px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('Sem cobranca!', W / 2, y + 54)
    ctx.fillStyle = '#555'; ctx.font = '20px sans-serif'
    ctx.fillText('Os prêmios cobriram todos os custos.', W / 2, y + 88)
    y += 154
  }

  ctx.fillStyle = COR_BORDA; ctx.fillRect(40, y + 10, W - 80, 1)
  ctx.fillStyle = '#bbbbbb'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'
  ctx.fillText('loterias.gldtecnologia.com.br · Bolão da Sorte', W / 2, y + 38)

  return canvas.toBuffer('image/png')
}

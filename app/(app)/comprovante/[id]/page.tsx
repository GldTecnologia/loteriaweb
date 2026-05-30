'use client'

import { use, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { Download, Printer, QrCode, CheckCircle, ArrowLeft, Share2, Mail, Send } from 'lucide-react'
import Link from 'next/link'
import type { Jogo } from '@/types'
import { Comprovante } from '@/components/Comprovante'
import { QRCodePIX } from '@/components/QRCodePIX'
import { formatBRL, formatDate } from '@/lib/utils'
import { Pix } from '@/lib/pix'

// Captura o componente HTML e gera PDF
// scale: 2 para download (alta resolução), 1.2 para e-mail (comprimido)
async function capturarPDF(opcoes: { scale?: number; jpeg?: boolean } = {}) {
  const { default: html2canvas } = await import('html2canvas')
  const { jsPDF } = await import('jspdf')

  const el = document.getElementById('comprovante-render')
  if (!el) throw new Error('Elemento não encontrado')

  const canvas = await html2canvas(el, {
    scale:           opcoes.scale ?? 2,
    useCORS:         true,
    backgroundColor: '#f1f5f9',
    logging:         false,
  })

  const imgData   = opcoes.jpeg ? canvas.toDataURL('image/jpeg', 0.72) : canvas.toDataURL('image/png')
  const imgFormat = opcoes.jpeg ? 'JPEG' : 'PNG'

  const PW = 210, PH = 297, M = 10
  const usableW = PW - M * 2   // 190 mm
  const usableH = PH - M * 2   // 277 mm

  // Altura proporcional se usarmos a largura total
  const aspect   = canvas.height / canvas.width
  const naturalH = usableW * aspect

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  if (naturalH <= usableH) {
    // Cabe em uma página — centraliza verticalmente
    doc.addImage(imgData, imgFormat, M, (PH - naturalH) / 2, usableW, naturalH)
  } else {
    // Conteúdo mais alto que A4 — reduz proporcionalmente para caber em uma página
    const ratio  = usableH / naturalH      // fator de redução
    const finalW = usableW * ratio         // largura reduzida
    const leftX  = (PW - finalW) / 2      // centraliza horizontalmente
    doc.addImage(imgData, imgFormat, leftX, M, finalW, usableH)
  }

  return doc
}

export default function ComprovantePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { toast } = useToast()
  const [jogos, setJogos]         = useState<Jogo[]>([])
  const [loading, setLoading]     = useState(true)
  const [showPix, setShowPix]     = useState(true)
  const [emailInput, setEmailInput] = useState('')
  const [showEmail, setShowEmail]   = useState(false)
  const [enviando, setEnviando]     = useState(false)
  const [baixando, setBaixando]     = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: jogoBase, error } = await supabase
        .from('jogos')
        .select('*, bolao:boloes(*)')
        .eq('id', id)
        .single()

      if (error || !jogoBase) { toast('Jogo não encontrado', 'error'); setLoading(false); return }

      if (jogoBase.bolao_id) {
        const { data: todos } = await supabase
          .from('jogos')
          .select('*, bolao:boloes(*)')
          .eq('bolao_id', jogoBase.bolao_id)
          .ilike('participante', jogoBase.participante)
          .order('sequencia', { ascending: true })
        setJogos((todos as Jogo[]) || [jogoBase as Jogo])
      } else {
        setJogos([jogoBase as Jogo])
      }
      setLoading(false)
    }
    load()
  }, [id])

  const jogoBase = jogos[0] ?? null

  async function handleDownloadPDF() {
    setBaixando(true)
    try {
      const doc = await capturarPDF({ scale: 2 })
      doc.save(`comprovante-${jogoBase?.participante || id}.pdf`)
      toast('PDF salvo com sucesso!', 'success')
    } catch {
      toast('Erro ao gerar PDF', 'error')
    } finally {
      setBaixando(false)
    }
  }

  async function handleEnviarEmail() {
    if (!emailInput.trim() || !emailInput.includes('@')) {
      toast('Informe um e-mail válido', 'error')
      return
    }
    setEnviando(true)
    try {
      const doc     = await capturarPDF({ scale: 1.3, jpeg: true })
      const pdfBlob = doc.output('blob')
      const bolao   = jogoBase?.bolao

      // Código de autenticação único (primeiro jogo)
      const authCode = (jogoBase?.codigo_autenticacao || '').replace(/-/g, '').toUpperCase().slice(0, 16)

      // Gera payload PIX com o authCode no txid para rastreabilidade
      let pixPayload = ''
      let pixQrBase64 = ''
      try {
        const QRCodeLib = (await import('qrcode')).default
        const supabase  = createClient()
        const { data: chavePix } = await supabase.from('chave_pix').select('*').limit(1).single()
        if (chavePix && bolao) {
          const authClean = (jogoBase?.codigo_autenticacao || '').replace(/-/g, '').toUpperCase()
          const pix = new Pix(
            chavePix.chave,
            `Auth:${authClean.slice(0, 16)}`,   // aparece no app do banco ao escanear
            chavePix.nome,
            chavePix.cidade,
            authClean.slice(0, 25),             // txid para identificar o pagamento
            bolao.valor_cota                    // valor unitário da cota, não o total
          )
          pixPayload = pix.getPayload()
          const qrDataUrl = await QRCodeLib.toDataURL(pixPayload, { width: 200, margin: 1 })
          pixQrBase64 = qrDataUrl.split(',')[1]
        }
      } catch { /* PIX opcional */ }

      const form = new FormData()
      form.append('email',        emailInput.trim())
      form.append('pdf',          pdfBlob, `comprovante-${jogoBase?.participante || id}.pdf`)
      form.append('participante', jogoBase?.participante || '')
      form.append('modalidade',   jogoBase?.modalidade   || '')
      form.append('concurso',     bolao?.concurso        || '')
      form.append('sorteio',      bolao ? `${formatDate(bolao.data_sorteio)}${bolao.hora_sorteio ? ' · ' + bolao.hora_sorteio.slice(0,5) : ''}` : '')
      form.append('premio',       bolao ? formatBRL(bolao.valor_premio_inicial) : '')
      form.append('cota',         bolao ? formatBRL(bolao.valor_cota)           : '')
      form.append('totalJogos',   String(jogos.length))
      form.append('authCode',     authCode)
      form.append('pixPayload',   pixPayload)
      form.append('pixQrBase64',  pixQrBase64)

      const res = await fetch('/api/enviar-comprovante', {
        method: 'POST',
        body:   form,
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao enviar')

      toast(`Comprovante enviado para ${emailInput.trim()}!`, 'success')
      setShowEmail(false)
      setEmailInput('')
    } catch (err: unknown) {
      toast((err as Error).message || 'Erro ao enviar e-mail', 'error')
    } finally {
      setEnviando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!jogoBase) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Comprovante não encontrado.</p>
        <Link href="/jogos">
          <Button className="mt-4" variant="outline"><ArrowLeft className="h-4 w-4" />Voltar</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3 no-print">
        <Link href="/jogos">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comprovante</h1>
          <p className="text-gray-500">
            {jogoBase.participante} · {jogos.length} jogo{jogos.length > 1 ? 's' : ''} registrado{jogos.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Sucesso */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 no-print">
        <CheckCircle className="h-6 w-6 text-green-600 shrink-0" />
        <div>
          <p className="font-semibold text-green-800">
            {jogos.length} jogo{jogos.length > 1 ? 's' : ''} registrado{jogos.length > 1 ? 's' : ''} com sucesso!
          </p>
          <p className="text-sm text-green-600">Faça o pagamento via PIX abaixo para confirmar sua participação.</p>
        </div>
      </div>

      {/* QR PIX */}
      {showPix && jogoBase.bolao && (
        <QRCodePIX jogo={jogoBase} onClose={() => setShowPix(false)} />
      )}

      {/* Comprovante visual */}
      <div id="comprovante-render">
        <Comprovante jogos={jogos} />
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-3 no-print">
        <Button onClick={handleDownloadPDF} variant="outline" loading={baixando}>
          <Download className="h-4 w-4" />
          Salvar PDF
        </Button>
        <Button onClick={() => window.print()} variant="outline">
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
        {!showPix && (
          <Button onClick={() => setShowPix(true)} variant="outline">
            <QrCode className="h-4 w-4" />
            Ver QR PIX
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => setShowEmail(v => !v)}
          className={showEmail ? 'border-blue-400 text-blue-700 bg-blue-50' : ''}
        >
          <Mail className="h-4 w-4" />
          Enviar por E-mail
        </Button>
        <Link href="/jogos">
          <Button>
            <Share2 className="h-4 w-4" />
            Novo Jogo
          </Button>
        </Link>
      </div>

      {/* Input de e-mail */}
      {showEmail && (
        <div className="flex gap-2 items-center bg-blue-50 border border-blue-200 rounded-xl p-3 no-print">
          <Mail className="h-4 w-4 text-blue-500 shrink-0" />
          <Input
            type="email"
            placeholder="Digite o e-mail do destinatário"
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEnviarEmail()}
            className="flex-1 bg-white"
            autoFocus
          />
          <Button onClick={handleEnviarEmail} loading={enviando} disabled={!emailInput.trim()}>
            <Send className="h-4 w-4" />
            Enviar
          </Button>
        </div>
      )}
    </div>
  )
}

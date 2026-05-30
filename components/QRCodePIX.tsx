'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { Copy, CheckCircle, X, QrCode } from 'lucide-react'
import { Pix } from '@/lib/pix'
import QRCodeLib from 'qrcode'
import type { Jogo } from '@/types'
import { formatBRL } from '@/lib/utils'

interface QRCodePIXProps {
  jogo: Jogo
  onClose?: () => void
}

export function QRCodePIX({ jogo, onClose }: QRCodePIXProps) {
  const { toast } = useToast()
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [pixPayload, setPixPayload] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  const bolao = jogo.bolao

  useEffect(() => {
    async function generate() {
      const supabase = createClient()
      const { data: chavePix } = await supabase.from('chave_pix').select('*').limit(1).single()

      if (!chavePix || !bolao) { setLoading(false); return }

      // Usa o código de autenticação como identificador do pagamento
      const authClean = (jogo.codigo_autenticacao || '').replace(/-/g, '').toUpperCase()
      const txid      = authClean.slice(0, 25)   // max 25 chars alfanuméricos
      const descricao = `Auth:${authClean.slice(0, 16)}`  // visível no app do banco

      const pix = new Pix(
        chavePix.chave,
        descricao,
        chavePix.nome,
        chavePix.cidade,
        txid,
        bolao.valor_cota
      )

      const payload = pix.getPayload()
      setPixPayload(payload)

      const url = await QRCodeLib.toDataURL(payload, {
        width: 280,
        margin: 2,
        color: { dark: '#1e3a8a', light: '#ffffff' },
      })
      setQrDataUrl(url)
      setLoading(false)
    }
    generate()
  }, [jogo, bolao])

  async function copyPix() {
    await navigator.clipboard.writeText(pixPayload)
    setCopied(true)
    toast('Código PIX copiado!', 'success')
    setTimeout(() => setCopied(false), 3000)
  }

  if (!bolao) return null

  return (
    <div className="bg-white border-2 border-green-200 rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <QrCode className="h-4 w-4 text-green-700" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Pagamento PIX</h3>
            <p className="text-xs text-gray-500">Escaneie para pagar sua cota</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* QR Code */}
        <div className="shrink-0">
          {loading ? (
            <div className="w-40 h-40 bg-gray-100 rounded-xl flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : qrDataUrl ? (
            <div className="p-3 bg-white border-2 border-gray-100 rounded-xl shadow-inner">
              <img src={qrDataUrl} alt="QR Code PIX" className="w-36 h-36" />
            </div>
          ) : (
            <div className="w-40 h-40 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center justify-center text-center p-3">
              <p className="text-xs text-yellow-700">Configure a chave PIX nas configurações</p>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 space-y-3 w-full">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 font-medium">Valor a pagar</p>
            <p className="text-2xl font-bold text-green-700">{formatBRL(bolao.valor_cota)}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-gray-500">Participante</p>
              <p className="font-semibold text-gray-900">{jogo.participante}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Sequência</p>
              <p className="font-semibold font-mono text-gray-900">#{jogo.sequencia}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Modalidade</p>
              <p className="font-semibold text-gray-900">{jogo.modalidade}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Concurso</p>
              <p className="font-semibold text-gray-900">#{bolao.concurso}</p>
            </div>
          </div>

          {pixPayload && (
            <Button
              variant="outline"
              className="w-full border-green-200 text-green-700 hover:bg-green-50"
              onClick={copyPix}
            >
              {copied ? (
                <><CheckCircle className="h-4 w-4" />Copiado!</>
              ) : (
                <><Copy className="h-4 w-4" />Copiar código PIX</>
              )}
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-center text-gray-400 mt-4">
        Após o pagamento, o administrador confirmará sua participação.
      </p>
    </div>
  )
}

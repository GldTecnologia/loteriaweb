import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { getWAState, iniciarWhatsApp } from '@/lib/whatsapp'

export async function GET() {
  await iniciarWhatsApp()
  const { isReady, qrString } = getWAState()
  if (isReady) return NextResponse.json({ conectado: true, qr: null })
  if (!qrString) return NextResponse.json({ conectado: false, qr: null })
  try {
    const dataUrl = await QRCode.toDataURL(qrString, { width: 280, margin: 2 })
    return NextResponse.json({ conectado: false, qr: dataUrl })
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 })
  }
}

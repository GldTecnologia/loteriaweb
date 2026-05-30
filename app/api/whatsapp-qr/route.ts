import { NextResponse } from 'next/server'
import { getWaStatus, getQrDataUrl, iniciarWhatsApp } from '@/lib/whatsapp'

export async function GET() {
  await iniciarWhatsApp()
  const { conectado } = getWaStatus()
  if (conectado) return NextResponse.json({ conectado: true, qr: null })
  const qr = getQrDataUrl()
  return NextResponse.json({ conectado: false, qr: qr || null })
}

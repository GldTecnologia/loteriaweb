import { NextResponse } from 'next/server'
import { getWAState, iniciarWhatsApp } from '@/lib/whatsapp'

export async function GET() {
  await iniciarWhatsApp()
  const { isReady } = getWAState()
  return NextResponse.json({ conectado: isReady })
}

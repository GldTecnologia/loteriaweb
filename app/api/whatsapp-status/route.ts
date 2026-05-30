import { NextResponse } from 'next/server'
import { getWaStatus, iniciarWhatsApp } from '@/lib/whatsapp'

export async function GET() {
  await iniciarWhatsApp()
  return NextResponse.json(getWaStatus())
}

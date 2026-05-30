import { NextResponse } from 'next/server'
import { reiniciarWhatsApp } from '@/lib/whatsapp'

export async function POST() {
  try {
    await reiniciarWhatsApp()
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, erro: (e as Error).message }, { status: 500 })
  }
}

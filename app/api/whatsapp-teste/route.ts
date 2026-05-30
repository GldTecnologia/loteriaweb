import { NextRequest, NextResponse } from 'next/server'
import { getWaStatus, iniciarWhatsApp, enviarMensagem } from '@/lib/whatsapp'

export async function GET(req: NextRequest) {
  await iniciarWhatsApp()
  const { searchParams } = req.nextUrl
  const jid   = searchParams.get('jid')
  const grupo = searchParams.get('grupo') || 'N/A'
  if (!jid) return NextResponse.json({ ok: false, erro: 'JID não informado.' }, { status: 400 })
  const { conectado } = getWaStatus()
  if (!conectado) return NextResponse.json({ ok: false, erro: 'WhatsApp não conectado.' }, { status: 503 })
  try {
    await enviarMensagem(jid, `✅ *Teste de conexão — Bolão Loteria*\n\nGrupo: *${grupo}*\nMensagem enviada com sucesso! 🍀`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, erro: (e as Error).message }, { status: 500 })
  }
}

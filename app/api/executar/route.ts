import { NextResponse } from 'next/server'
import { processarConferencia } from '@/lib/confAutomatico'

export async function GET() {
  try {
    await processarConferencia()
    return NextResponse.json({ status: '✅ Conferência executada com sucesso.' })
  } catch (err) {
    console.error('[executar]', err)
    return NextResponse.json({ error: '❌ Erro na execução.', detalhe: (err as Error).message }, { status: 500 })
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { iniciarWhatsApp } = await import('./lib/whatsapp')
    iniciarWhatsApp().catch(e => console.error('[WA] Erro ao iniciar:', e))
  }
}

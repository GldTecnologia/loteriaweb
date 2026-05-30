import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import QRCode from 'qrcode'
import { EventEmitter } from 'events'
import os from 'os'
import path from 'path'

type WASocket = ReturnType<typeof makeWASocket>

interface WASingleton {
  sock: WASocket | null
  isReady: boolean
  qrDataUrl: string | null
  events: EventEmitter
  init: boolean
}

declare global {
  // eslint-disable-next-line no-var
  var _wa: WASingleton | undefined
}

// Armazenado fora do projeto para não interferir no file tracing do Next.js
function getAuthPath(): string {
  return process.env.WA_AUTH_PATH || path.join(os.homedir(), '.wa-loteria-auth')
}

function wa(): WASingleton {
  if (!global._wa) {
    global._wa = { sock: null, isReady: false, qrDataUrl: null, events: new EventEmitter(), init: false }
  }
  return global._wa
}

export function getQrDataUrl() { return wa().qrDataUrl }
export function getWaStatus()  { return { conectado: wa().isReady } }

export async function iniciarWhatsApp() {
  const s = wa()
  if (s.init) return
  s.init = true

  const logger   = pino({ level: 'silent' })
  const authPath = getAuthPath()
  const { state, saveCreds } = await useMultiFileAuthState(authPath)

  // Fallback para versão fixa caso a busca online falhe
  let version: [number, number, number] = [2, 3000, 1015901307]
  try {
    const res = await fetchLatestBaileysVersion()
    version = res.version
  } catch {
    console.warn('[WA] Não foi possível buscar versão do Baileys. Usando versão padrão.')
  }

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: ['Bolão Loteria', 'Chrome', '120.0.0'],
  })
  s.sock = sock

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n[WA] 📱 QR Code gerado — acesse /whatsapp para escanear\n')
      try {
        s.qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 })
        s.events.emit('qr', s.qrDataUrl)
      } catch (e) {
        console.error('[WA] Erro ao gerar QR:', (e as Error).message)
      }
    }

    if (connection === 'close') {
      s.isReady   = false
      s.qrDataUrl = null
      const code = lastDisconnect?.error instanceof Boom
        ? (lastDisconnect.error as Boom).output?.statusCode
        : null
      const loggedOut = code === DisconnectReason.loggedOut
      console.log(`[WA] 🔌 Conexão encerrada (código ${code}). Reconectando: ${!loggedOut}`)
      if (!loggedOut) {
        s.init = false
        setTimeout(() => iniciarWhatsApp(), 5000)
      } else {
        console.log('[WA] ❌ Sessão encerrada. Use a página /whatsapp para reconectar.')
      }
    }

    if (connection === 'open') {
      console.log('[WA] ✅ Conectado!\n')
      s.isReady   = true
      s.qrDataUrl = null
      s.events.emit('ready')

      try {
        const chats  = await sock.groupFetchAllParticipating()
        const grupos = Object.values(chats) as Array<{ subject: string; id: string }>
        if (grupos.length > 0) {
          console.log('━'.repeat(55))
          console.log('[WA] 📋 SEUS GRUPOS — copie o JID para o banco')
          console.log('━'.repeat(55))
          grupos.forEach((g, i) => {
            console.log(`${String(i + 1).padStart(2)}. ${g.subject}`)
            console.log(`    JID: ${g.id}`)
          })
          console.log('━'.repeat(55))
        }
      } catch (e) {
        console.log('[WA] ℹ️  Não foi possível listar grupos:', (e as Error).message)
      }
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sock.ev.on('messages.upsert', ({ messages }: { messages: any[] }) => {
    for (const msg of messages) {
      if (!msg.key.fromMe && msg.message) {
        const jid  = msg.key.remoteJid as string
        const nome = msg.pushName || 'Desconhecido'
        const tipo = jid.endsWith('@g.us') ? 'GRUPO' : 'CONTATO'
        console.log(`[WA] 📨 [${tipo}] ${nome} — JID: ${jid}`)
      }
    }
  })

  return sock
}

export async function reiniciarWhatsApp() {
  const s = wa()
  if (s.sock) {
    try { await s.sock.logout() } catch {}
    s.sock = null
  }
  s.isReady   = false
  s.qrDataUrl = null
  s.init      = false
  const { rm } = await import('fs/promises')
  try { await rm(getAuthPath(), { recursive: true, force: true }) } catch {}
  await iniciarWhatsApp()
}

export async function enviarMensagem(jid: string, texto: string) {
  const s = wa()
  if (!s.sock || !s.isReady) { console.error('[WA] ❌ Não conectado.'); return }
  try {
    await s.sock.sendMessage(jid, { text: texto })
    console.log(`[WA] 📤 Mensagem → ${jid}`)
  } catch (err) {
    console.error('[WA] ❌ Erro ao enviar:', (err as Error).message)
  }
}

export async function enviarImagemBuffer(jid: string, buffer: Buffer, caption = '') {
  const s = wa()
  if (!s.sock || !s.isReady) { console.error('[WA] ❌ Não conectado.'); return }
  try {
    await s.sock.sendMessage(jid, { image: buffer, caption })
    console.log(`[WA] 🖼️  Imagem → ${jid}`)
  } catch (err) {
    console.error('[WA] ❌ Erro ao enviar imagem:', (err as Error).message)
  }
}

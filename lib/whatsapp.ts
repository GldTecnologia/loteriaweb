import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import { EventEmitter } from 'events'
import os from 'os'
import path from 'path'

type WASocket = ReturnType<typeof makeWASocket>

interface WASingleton {
  sock: WASocket | null
  ready: boolean
  qr: string | null
  events: EventEmitter
  init: boolean
}

declare global {
  // eslint-disable-next-line no-var
  var _wa: WASingleton | undefined
}

// Armazena fora do projeto para não interferir no build do Next.js
function getAuthPath(): string {
  return process.env.WA_AUTH_PATH || path.join(os.homedir(), '.wa-loteria-auth')
}

function wa(): WASingleton {
  if (!global._wa) {
    global._wa = { sock: null, ready: false, qr: null, events: new EventEmitter(), init: false }
  }
  return global._wa
}

export function getWAState() {
  const s = wa()
  return { isReady: s.ready, qrString: s.qr }
}

export async function iniciarWhatsApp() {
  const s = wa()
  if (s.init) return
  s.init = true

  const logger   = pino({ level: 'silent' })
  const authPath = getAuthPath()
  const { state, saveCreds } = await useMultiFileAuthState(authPath)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,
    browser: ['Bolão Loteria', 'Chrome', '120.0.0'],
  })
  s.sock = sock

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      s.qr = qr
      s.events.emit('qr', qr)
    }
    if (connection === 'close') {
      s.ready = false
      const code = lastDisconnect?.error instanceof Boom
        ? (lastDisconnect.error as Boom).output?.statusCode
        : null
      if (code !== DisconnectReason.loggedOut) {
        s.init = false
        setTimeout(() => iniciarWhatsApp(), 5000)
      } else {
        console.error('[WA] Sessão expirada. Reinicie pela página /whatsapp.')
      }
    }
    if (connection === 'open') {
      s.ready = true
      s.qr = null
      s.events.emit('ready')
      console.log('[WA] Conectado!')
    }
  })
}

export async function reiniciarWhatsApp() {
  const s = wa()
  if (s.sock) {
    try { await s.sock.logout() } catch {}
    s.sock = null
  }
  s.ready = false
  s.qr    = null
  s.init  = false
  const { rm } = await import('fs/promises')
  try { await rm(getAuthPath(), { recursive: true, force: true }) } catch {}
  await iniciarWhatsApp()
}

export async function enviarMensagem(jid: string, texto: string) {
  const s = wa()
  if (!s.sock || !s.ready) throw new Error('WhatsApp não conectado')
  await s.sock.sendMessage(jid, { text: texto })
}

export async function enviarImagemBuffer(jid: string, buffer: Buffer, caption = '') {
  const s = wa()
  if (!s.sock || !s.ready) throw new Error('WhatsApp não conectado')
  await s.sock.sendMessage(jid, { image: buffer, caption })
}

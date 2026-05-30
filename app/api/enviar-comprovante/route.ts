import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

const COR: Record<string, { solid: string; dark: string; light: string; grad: string }> = {
  'Mega-Sena':  { solid:'#00A651', dark:'#005229', light:'#e6f7ee', grad:'linear-gradient(135deg,#005229,#00A651,#059669)' },
  'Lotofácil':  { solid:'#91278F', dark:'#5c1a5a', light:'#f5e8f5', grad:'linear-gradient(135deg,#4c1d95,#7e22ce,#9d174d)' },
  'Quina':      { solid:'#2E3192', dark:'#1c1e5e', light:'#e8e9f5', grad:'linear-gradient(135deg,#1e1b4b,#2E3192,#4f46e5)' },
  'Dupla Sena': { solid:'#A62B43', dark:'#6b1529', light:'#f5e8eb', grad:'linear-gradient(135deg,#7f1d1d,#A62B43,#e11d48)' },
}
const DC = { solid:'#1e3a8a', dark:'#0f172a', light:'#eff6ff', grad:'linear-gradient(135deg,#0f172a,#1e3a8a)' }

const CLOVER_SVG = `<svg viewBox="0 0 100 100" width="100%" height="100%" fill="currentColor">
  <path d="M50 8C39 8 31 17 31 28c0 3 .7 6 2 8-3-1-6-2-9-2C13 34 5 43 5 54s9 20 20 20c3 0 6-.7 8-2-1.3 3-2 6-2 9 0 11 8 20 19 20s19-9 19-20c0-3-.7-6-2-9 3 1 6 2 9 2 11 0 20-9 20-20s-8-20-19-20c-3 0-6 .7-9 2 1.3-2 2-5 2-8C70 17 61 8 50 8z"/>
  <path d="M47 66h7v27h-7z"/>
</svg>`

function icon(svg: string, size: number, color: string) {
  return `<div style="width:${size}px;height:${size}px;color:${color};display:inline-block;">${svg}</div>`
}

const IC = {
  check:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
  shield:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  trophy:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>`,
  dice:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.5" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.5" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>`,
  user:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
  file:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  lock:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  badge:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/></svg>`,
  clip:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`,
}

export async function POST(req: Request) {
  try {
    const form         = await req.formData()
    const email        = form.get('email')        as string
    const pdfFile      = form.get('pdf')          as File | null
    const participante = form.get('participante') as string
    const modalidade   = form.get('modalidade')   as string
    const concurso     = form.get('concurso')     as string
    const sorteio      = form.get('sorteio')      as string
    const premio       = form.get('premio')       as string
    const cota         = form.get('cota')         as string
    const totalJogos   = Number(form.get('totalJogos') ?? 1)
    const authCode     = form.get('authCode')     as string
    const pixPayload   = form.get('pixPayload')   as string
    const pixQrBase64  = form.get('pixQrBase64')  as string

    if (!email || !pdfFile) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer())
    const c         = COR[modalidade] ?? DC
    const primNome  = (participante || '').split(' ')[0]
    const SITE      = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://loterias.gldtecnologia.com.br'

    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })

    const pixQrAttachment = pixQrBase64
      ? [{ filename:'qr-pix.png', content: Buffer.from(pixQrBase64,'base64'), contentType:'image/png', cid:'qr-pix' }]
      : []

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 20px 45px rgba(15,23,42,.14);">

  <!-- HEADER -->
  <tr><td style="background:${c.grad};padding:28px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:middle;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="width:72px;height:72px;background:rgba(255,255,255,.14);border-radius:16px;padding:12px;vertical-align:middle;">
            <div style="width:48px;height:48px;color:#fff;">${CLOVER_SVG}</div>
          </td>
          <td style="padding-left:18px;vertical-align:middle;">
            <div style="color:#fff;font-size:24px;font-weight:900;margin:0;letter-spacing:-0.3px;">GESTÃO DE APOSTAS</div>
            <div style="color:rgba(255,255,255,.7);font-size:14px;margin-top:4px;">Sistema de Gestão de Apostas</div>
          </td>
        </tr></table>
      </td>
      <td style="text-align:right;vertical-align:middle;">
        <div style="color:#fff;font-size:20px;font-weight:900;">${modalidade}</div>
        <div style="margin-top:10px;background:rgba(255,255,255,.18);padding:7px 14px;border-radius:8px;color:#fff;font-weight:800;font-size:14px;display:inline-block;">${concurso ? '#' + concurso : '—'}</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- SUCESSO -->
  <tr><td style="background:#f0fdf4;border-bottom:1px solid #bbf7d0;padding:18px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="width:40px;vertical-align:middle;">${icon(IC.check, 38, '#16a34a')}</td>
      <td style="padding:0 16px;vertical-align:middle;">
        <div style="color:#15803d;font-size:18px;font-weight:900;margin:0;">Aposta registrada com sucesso!</div>
        <div style="color:#1f2937;font-size:13px;margin-top:4px;">Finalize o pagamento via PIX para confirmar sua participação.</div>
      </td>
      <td style="width:44px;vertical-align:middle;text-align:right;">${icon(IC.shield, 40, '#16a34a')}</td>
    </tr></table>
  </td></tr>

  <!-- INTRO -->
  <tr><td style="padding:28px 32px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:top;">
        <div style="font-size:22px;font-weight:900;color:#0f172a;margin-bottom:10px;">Olá, ${primNome}! 👋</div>
        <div style="color:#475569;font-size:14px;line-height:1.7;">
          Seu comprovante de aposta na <strong style="color:${c.solid};">${modalidade}</strong> está pronto.<br/>
          O arquivo PDF completo com todos os jogos e o código de autenticação está em anexo neste e-mail.
        </div>
      </td>
      <td style="width:90px;text-align:center;vertical-align:middle;padding-left:20px;">
        <div style="position:relative;display:inline-block;">
          ${icon(IC.file, 72, c.solid)}
          <div style="margin-top:-16px;text-align:right;">${icon(IC.check, 30, '#16a34a')}</div>
        </div>
      </td>
    </tr></table>
  </td></tr>

  <!-- INFO GRID -->
  <tr><td style="padding:0 32px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="padding:16px;border-right:1px solid #e5e7eb;text-align:center;vertical-align:middle;">
          ${icon(IC.calendar, 28, c.solid)}
          <div style="font-size:10px;font-weight:900;color:#475569;text-transform:uppercase;letter-spacing:.05em;margin:8px 0 4px;">CONCURSO</div>
          <div style="font-size:18px;font-weight:900;color:#111827;">${concurso ? '#' + concurso : '—'}</div>
        </td>
        <td style="padding:16px;border-right:1px solid #e5e7eb;text-align:center;vertical-align:middle;">
          ${icon(IC.calendar, 28, c.solid)}
          <div style="font-size:10px;font-weight:900;color:#475569;text-transform:uppercase;letter-spacing:.05em;margin:8px 0 4px;">SORTEIO</div>
          <div style="font-size:14px;font-weight:900;color:#111827;">${sorteio || '—'}</div>
        </td>
        <td style="padding:16px;border-right:1px solid #e5e7eb;text-align:center;vertical-align:middle;">
          ${icon(IC.trophy, 28, '#16a34a')}
          <div style="font-size:10px;font-weight:900;color:#475569;text-transform:uppercase;letter-spacing:.05em;margin:8px 0 4px;">PRÊMIO EST.</div>
          <div style="font-size:14px;font-weight:900;color:#16a34a;">${premio || '—'}</div>
        </td>
        <td style="padding:16px;text-align:center;vertical-align:middle;">
          ${icon(IC.dice, 28, c.solid)}
          <div style="font-size:10px;font-weight:900;color:#475569;text-transform:uppercase;letter-spacing:.05em;margin:8px 0 4px;">JOGOS</div>
          <div style="font-size:20px;font-weight:900;color:#111827;">${totalJogos}</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- PARTICIPANTE -->
  <tr><td style="padding:0 32px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${c.light};border-radius:14px;padding:18px 22px;">
      <tr>
        <td style="width:52px;vertical-align:middle;">
          <div style="width:52px;height:52px;border-radius:50%;background:${c.solid};color:#fff;text-align:center;line-height:52px;font-size:22px;">
            ${icon(IC.user, 28, '#fff')}
          </div>
        </td>
        <td style="padding-left:16px;vertical-align:middle;">
          <div style="font-size:11px;font-weight:900;color:${c.dark};text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">PARTICIPANTE</div>
          <div style="font-size:20px;font-weight:900;color:#0f172a;">${participante}</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- PIX -->
  <tr><td style="padding:0 32px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid ${c.solid};border-radius:14px;padding:22px 24px;">
      <tr>
        <td style="vertical-align:middle;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:44px;height:44px;background:#f8fafc;border-radius:10px;text-align:center;vertical-align:middle;font-size:24px;color:#14b8a6;">❖</td>
            <td style="padding-left:16px;vertical-align:middle;">
              <div style="font-size:12px;font-weight:900;color:${c.solid};text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">PAGAMENTO VIA PIX</div>
              <div style="font-size:30px;font-weight:900;color:${c.solid};margin-bottom:4px;">${cota}</div>
              <div style="font-size:12px;color:#64748b;">Valor da cota por jogo &bull; ${totalJogos} jogo${totalJogos > 1 ? 's' : ''}</div>
            </td>
          </tr></table>

          ${pixPayload ? `
          <div style="margin-top:16px;">
            <div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Código PIX — Copia e Cola:</div>
            <div style="background:#f8fafc;border:1px dashed #94a3b8;border-radius:8px;padding:10px 12px;font-family:monospace;font-size:11px;color:#374151;word-break:break-all;line-height:1.5;">${pixPayload}</div>
          </div>` : ''}

          ${authCode ? `
          <div style="margin-top:12px;background:#f8fafc;border-left:3px solid ${c.solid};border-radius:6px;padding:10px 14px;">
            <div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;margin-bottom:4px;">🔐 Identificador do Pagamento (Auth)</div>
            <div style="font-family:monospace;font-size:15px;font-weight:900;color:#0f172a;letter-spacing:.06em;">${authCode}</div>
          </div>` : ''}
        </td>

        <td style="width:140px;text-align:center;vertical-align:middle;padding-left:24px;">
          ${pixQrBase64
            ? `<img src="cid:qr-pix" width="120" height="120" alt="QR PIX" style="border-radius:10px;display:block;margin:0 auto;"/><div style="font-size:10px;color:#64748b;margin-top:8px;">Escaneie para pagar</div>`
            : ''
          }
          <div style="margin-top:${pixQrBase64 ? 14 : 0}px;">
            <div style="background:${c.grad};color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:900;font-size:14px;display:inline-block;text-align:center;">❖ PAGAR VIA PIX</div>
            <div style="margin-top:8px;font-size:11px;color:#64748b;display:flex;align-items:center;justify-content:center;gap:4px;">🔒 Ambiente 100% seguro</div>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- ANEXO -->
  <tr><td style="padding:0 32px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:18px 22px;">
      <tr>
        <td style="width:36px;vertical-align:middle;">${icon(IC.clip, 34, '#92400e')}</td>
        <td style="padding-left:14px;vertical-align:middle;">
          <div style="font-size:16px;font-weight:900;color:#92400e;margin-bottom:4px;">Comprovante em anexo (PDF)</div>
          <div style="font-size:13px;color:#44403c;">Contém todos os jogos, números apostados e o código de autenticação da sua aposta.</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- FOOTER BADGES -->
  <tr><td style="background:#17243a;padding:24px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:20px;margin-bottom:20px;">
      <tr>
        <td style="width:33%;padding-right:16px;vertical-align:top;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:top;">${icon(IC.shield, 34, '#a855f7')}</td>
            <td style="padding-left:12px;vertical-align:top;">
              <div style="font-size:12px;font-weight:900;color:#e2e8f0;margin-bottom:3px;">Pagamento seguro</div>
              <div style="font-size:11px;color:#94a3b8;">Seus dados protegidos com criptografia.</div>
            </td>
          </tr></table>
        </td>
        <td style="width:33%;padding:0 8px;vertical-align:top;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:top;">${icon(IC.badge, 34, '#a855f7')}</td>
            <td style="padding-left:12px;vertical-align:top;">
              <div style="font-size:12px;font-weight:900;color:#e2e8f0;margin-bottom:3px;">Aposta oficial</div>
              <div style="font-size:11px;color:#94a3b8;">Comprovante válido para o concurso.</div>
            </td>
          </tr></table>
        </td>
        <td style="width:33%;padding-left:16px;vertical-align:top;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:top;">${icon(IC.lock, 34, '#a855f7')}</td>
            <td style="padding-left:12px;vertical-align:top;">
              <div style="font-size:12px;font-weight:900;color:#e2e8f0;margin-bottom:3px;">Dúvidas?</div>
              <div style="font-size:11px;color:#94a3b8;">Fale com o organizador do seu bolão.</div>
            </td>
          </tr></table>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:middle;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="width:36px;height:36px;color:#fff;vertical-align:middle;">${CLOVER_SVG}</td>
          <td style="padding-left:12px;vertical-align:middle;">
            <div style="color:#fff;font-size:14px;font-weight:900;">GESTÃO DE APOSTAS</div>
            <div style="color:rgba(255,255,255,.5);font-size:11px;margin-top:2px;">Sistema de gestão para bolões e apostas.</div>
          </td>
        </tr></table>
      </td>
      <td style="text-align:right;vertical-align:middle;max-width:280px;">
        <div style="color:rgba(255,255,255,.6);font-size:11px;line-height:1.6;">Guarde este e-mail e o PDF em anexo como comprovante da sua participação.</div>
        <div style="color:rgba(255,255,255,.3);font-size:10px;margin-top:4px;">${SITE}</div>
      </td>
    </tr></table>
  </td></tr>

</table>
</td></tr></table>
</body>
</html>`

    await transporter.sendMail({
      from:    `"Gestão de Apostas" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to:      email,
      subject: `🍀 Comprovante — ${modalidade}${concurso ? ' #'+concurso : ''} · ${participante}`,
      html,
      attachments: [
        { filename: `comprovante-${(participante||'aposta').replace(/\s+/g,'-')}.pdf`, content: pdfBuffer, contentType: 'application/pdf' },
        ...pixQrAttachment,
      ],
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('[enviar-comprovante]', err)
    return NextResponse.json({ error: (err as Error).message || 'Erro ao enviar' }, { status: 500 })
  }
}

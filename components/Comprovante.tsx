'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { ShieldCheck, Lock, BadgeCheck, User, Clock } from 'lucide-react'
import { formatDate, formatBRL, apostaToNumeros } from '@/lib/utils'
import { MODALIDADE_CONFIG } from '@/types'
import type { Jogo, Modalidade } from '@/types'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://loterias.gldtecnologia.com.br'

interface ComprovanteProps { jogos: Jogo[] }

const T: Record<string, {
  p900: string; p800: string; p700: string; p300: string
  gradient: string; footerGrad: string; stripeColor: string
}> = {
  'Lotofácil':  { p900:'#5c1a5a', p800:'#741e71', p700:'#91278F', p300:'#c987c7', gradient:'linear-gradient(135deg,#5c1a5a,#91278F)', footerGrad:'linear-gradient(to right,#3a0d38,#5c1a5a)', stripeColor:'#91278F' },
  'Mega-Sena':  { p900:'#005229', p800:'#006b35', p700:'#00A651', p300:'#7dd4a2', gradient:'linear-gradient(135deg,#005229,#00A651)', footerGrad:'linear-gradient(to right,#002d16,#005229)', stripeColor:'#00A651' },
  'Quina':      { p900:'#1c1e5e', p800:'#252877', p700:'#2E3192', p300:'#9fa2cc', gradient:'linear-gradient(135deg,#1c1e5e,#2E3192)', footerGrad:'linear-gradient(to right,#0d0e3c,#1c1e5e)', stripeColor:'#2E3192' },
  'Dupla Sena': { p900:'#6b1529', p800:'#871a33', p700:'#A62B43', p300:'#cc8e9a', gradient:'linear-gradient(135deg,#6b1529,#A62B43)', footerGrad:'linear-gradient(to right,#420c19,#6b1529)', stripeColor:'#A62B43' },
}
const DT = T['Quina']

function CloverLogo({ style }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" style={style}>
      <path d="M50 8C39 8 31 17 31 28c0 3 .7 6 2 8-3-1.3-6-2-9-2C13 34 5 43 5 54s9 20 20 20c3 0 6-.7 8-2-1.3 3-2 6-2 9 0 11 8 20 19 20s19-9 19-20c0-3-.7-6-2-9 3 1.3 6 2 9 2 11 0 20-9 20-20s-8-20-19-20c-3 0-6 .7-9 2 1.3-2 2-5 2-8C70 17 61 8 50 8z" />
      <path d="M48 66h6v28h-6z" />
    </svg>
  )
}

function InfoCell({ label, value, borderColor, labelColor, last = false }: {
  label: string; value: string; borderColor: string; labelColor: string; last?: boolean
}) {
  return (
    <div style={{ padding: '8px 10px', borderRight: last ? 'none' : `1px solid ${borderColor}` }}>
      <p style={{ fontSize: 9, fontWeight: 900, color: labelColor, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', margin: 0 }}>{value}</p>
    </div>
  )
}

function FooterBadge({ icon, title, text, borderColor, last = false }: {
  icon: React.ReactNode; title: string; text: string; borderColor: string; last?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRight: last ? 'none' : `1px solid ${borderColor}` }}>
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ fontSize: 10, fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.03em', margin: 0 }}>{title}</p>
        <p style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{text}</p>
      </div>
    </div>
  )
}

export function Comprovante({ jogos }: ComprovanteProps) {
  const [qrUrl, setQrUrl] = useState('')

  const primeiro = jogos[0]
  const bolao    = primeiro?.bolao
  const mod      = primeiro?.modalidade as Modalidade
  const th       = T[mod] ?? DT
  const maxNum   = MODALIDADE_CONFIG[mod]?.max ?? 60
  const todosNumeros = Array.from({ length: maxNum }, (_, i) => i + 1)
  const cols     = maxNum <= 25 ? 10 : maxNum <= 50 ? 10 : maxNum <= 60 ? 12 : 16
  const cellFont = cols <= 10 ? 11 : cols <= 12 ? 10 : 9

  // Código único para todos os jogos do participante — usa o do primeiro jogo
  const codigoAuth = (primeiro?.codigo_autenticacao || '').replace(/-/g, '').toUpperCase().slice(0, 16)

  useEffect(() => {
    if (!primeiro?.codigo_autenticacao) return
    QRCode.toDataURL(`${SITE}/validar/${primeiro.codigo_autenticacao}`, { width: 128, margin: 1 })
      .then(setQrUrl)
  }, [primeiro?.codigo_autenticacao])

  if (!primeiro) return null

  const stripe = `repeating-linear-gradient(to bottom,${th.stripeColor} 0,${th.stripeColor} 3px,transparent 3px,transparent 7px)`

  return (
    <div style={{ fontFamily: "'Inter',Arial,sans-serif", background: '#f1f5f9', padding: 12 }}>
      <div style={{ maxWidth: 800, margin: '0 auto', background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>

        {/* Corpo */}
        <div style={{ position: 'relative', borderLeft: '16px solid rgba(0,0,0,0.03)', borderRight: '16px solid rgba(0,0,0,0.03)', padding: '16px 20px' }}>

          {/* Listras */}
          <div style={{ position: 'absolute', left: -8, top: 24, width: 10, height: 72, background: stripe }} />
          <div style={{ position: 'absolute', right: -8, top: 24, width: 10, height: 72, background: stripe }} />

          {/* CABEÇALHO */}
          <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: `2px solid ${th.p800}`, paddingBottom: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 56, height: 56, color: th.p900, flexShrink: 0 }}><CloverLogo /></div>
              <div>
                <h1 style={{ fontSize: 17, fontWeight: 900, color: th.p900, letterSpacing: '-0.3px', margin: 0 }}>GESTÃO DE APOSTAS</h1>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', margin: '2px 0 0' }}>Comprovante de Aposta</p>
                <p style={{ fontSize: 10, fontWeight: 900, color: th.p900, margin: '1px 0 0' }}>BOLÃO OFICIAL</p>
              </div>
            </div>

            <div style={{ width: 130, borderRadius: 8, border: `2px solid ${th.p800}`, overflow: 'hidden', textAlign: 'center', flexShrink: 0 }}>
              <div style={{ background: th.p900, padding: '5px 0' }}>
                <p style={{ color: '#fff', fontWeight: 900, fontSize: 12, margin: 0 }}>{mod.toUpperCase()}</p>
              </div>
              <div style={{ padding: 8 }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', margin: 0 }}>Concurso</p>
                <p style={{ fontSize: 20, fontWeight: 900, margin: '1px 0' }}>{bolao?.concurso ?? '—'}</p>
                <div style={{ borderTop: `1px solid ${th.p300}`, margin: '5px 0' }} />
                <p style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', margin: 0 }}>Sorteio</p>
                <p style={{ fontSize: 12, fontWeight: 900, marginTop: 1 }}>
                  {bolao ? formatDate(bolao.data_sorteio) : '—'}
                  {bolao?.hora_sorteio ? ` · ${bolao.hora_sorteio.slice(0, 5)}` : ''}
                </p>
              </div>
            </div>
          </header>

          {/* INFO STRIP */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderRadius: 8, border: `2px solid ${th.p700}`, overflow: 'hidden', marginBottom: 10 }}>
            <InfoCell label="Prêmio Estimado"    value={formatBRL(bolao?.valor_premio_inicial ?? 0)} borderColor={th.p300} labelColor={th.p800} />
            <InfoCell label="Cota"               value={formatBRL(bolao?.valor_cota ?? 0)}           borderColor={th.p300} labelColor={th.p800} />
            <InfoCell label="Jogos"              value={String(jogos.length)}                        borderColor={th.p300} labelColor={th.p800} />
            <InfoCell label="Data/Hora da Compra" value={new Date(primeiro.data).toLocaleString('pt-BR')} borderColor={th.p300} labelColor={th.p800} last />
          </div>

          {/* PARTICIPANTE + VOLANTES */}
          <div style={{ borderRadius: 8, border: `2px solid ${th.p300}`, overflow: 'hidden', marginBottom: 10 }}>

            {/* Cabeçalho participante */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${th.p300}`, padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: th.p800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <User size={18} />
                </div>
                <div>
                  <p style={{ fontSize: 9, fontWeight: 900, color: th.p800, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Participante</p>
                  <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: '1px 0 0' }}>{primeiro.participante}</h2>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fef3c7', border: '1.5px solid #f59e0b', borderRadius: 8, padding: '6px 12px' }}>
                <Clock size={14} color="#b45309" />
                <div>
                  <p style={{ fontSize: 10, fontWeight: 900, color: '#92400e', textTransform: 'uppercase', margin: 0 }}>JOGO REGISTRADO</p>
                  <p style={{ fontSize: 9, color: '#b45309', margin: '1px 0 0' }}>Aguardando pagamento PIX</p>
                </div>
              </div>
            </div>

            {/* Um volante por jogo */}
            {jogos.map((jogo, idx) => {
              const numeros = apostaToNumeros(jogo.aposta)
              return (
                <div key={jogo.id} style={{ borderTop: idx > 0 ? `1px dashed ${th.p300}` : undefined }}>

                  {/* Linha topo do jogo */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 4px' }}>
                    <p style={{ fontSize: 10, fontWeight: 900, color: th.p900, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                      Números Apostados
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>{numeros.length} números</span>
                      <div style={{ background: th.gradient, borderRadius: 6, padding: '3px 10px', color: '#fff' }}>
                        <p style={{ fontSize: 8, fontWeight: 700, margin: 0 }}>SEQUÊNCIA</p>
                        <p style={{ fontSize: 14, fontWeight: 900, margin: 0 }}>#{jogo.sequencia}</p>
                      </div>
                    </div>
                  </div>

                  {/* Grade */}
                  <div style={{ padding: '4px 14px 10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 3 }}>
                      {todosNumeros.map(n => {
                        const sel = numeros.includes(n)
                        return (
                          <div
                            key={n}
                            style={{
                              aspectRatio: '1',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              borderRadius: 4,
                              fontSize: cellFont, fontWeight: 900,
                              border: sel ? `1.5px solid ${th.p900}` : `1px dashed ${th.p300}`,
                              background: sel ? th.gradient : '#fff',
                              color: sel ? '#fff' : '#94a3b8',
                              boxShadow: sel ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                            }}
                          >
                            {String(n).padStart(2, '0')}
                          </div>
                        )
                      })}
                    </div>
                    <p style={{ marginTop: 6, textAlign: 'center', fontSize: 10, fontWeight: 900, color: th.p900 }}>
                      {numeros.length} NÚMEROS ESCOLHIDOS
                    </p>
                  </div>

                  {/* Auth + QR — mesmo código para todos os jogos */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 14px 12px' }}>
                    <div style={{ borderRadius: 8, border: `2px solid ${th.p700}`, padding: '10px 12px', textAlign: 'center' }}>
                      <p style={{ fontWeight: 900, color: th.p900, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px' }}>Código de Autenticação</p>
                      <div style={{ borderRadius: 6, border: `1.5px solid ${th.p300}`, padding: '6px 10px', marginBottom: 6 }}>
                        <p style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 900, letterSpacing: '0.06em', color: '#0f172a', wordBreak: 'break-all', margin: 0 }}>
                          {codigoAuth}
                        </p>
                      </div>
                      <p style={{ fontSize: 10, color: '#475569', margin: 0 }}>
                        Registrado em <strong>{new Date(primeiro.data).toLocaleString('pt-BR')}</strong>
                      </p>
                    </div>

                    <div style={{ borderRadius: 8, border: `2px solid ${th.p700}`, padding: '10px 12px', textAlign: 'center' }}>
                      <p style={{ fontWeight: 900, color: th.p900, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>QR Code de Validação</p>
                      {qrUrl
                        ? <img src={qrUrl} alt="QR" style={{ width: 100, height: 100, borderRadius: 6, margin: '0 auto', display: 'block' }} />
                        : <div style={{ width: 100, height: 100, background: '#f1f5f9', borderRadius: 6, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 10 }}>...</div>
                      }
                      <p style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>Escaneie para validar</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* BADGES */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderRadius: 8, border: `1px solid ${th.p300}`, overflow: 'hidden' }}>
            <FooterBadge icon={<ShieldCheck size={20} color={th.p800} />} title="Participação Registrada" text="Seu jogo está salvo no sistema."         borderColor={th.p300} />
            <FooterBadge icon={<Lock        size={20} color={th.p800} />} title="Aposte com Segurança"    text="Ambiente 100% seguro e certificado."     borderColor={th.p300} />
            <FooterBadge icon={<BadgeCheck  size={20} color={th.p800} />} title="Comprovante Oficial"     text={`Válido para o concurso ${bolao?.concurso ?? ''}.`} borderColor={th.p300} last />
          </div>
        </div>

        {/* RODAPÉ */}
        <footer style={{ background: th.footerGrad, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, color: '#fff', flexShrink: 0 }}><CloverLogo /></div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 900, color: '#fff', margin: 0 }}>GESTÃO DE APOSTAS</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', margin: '1px 0 0' }}>A união que aumenta suas chances!</p>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 10, color: 'rgba(255,255,255,0.75)' }}>
            <p style={{ margin: 0 }}>Guarde este comprovante para conferência.</p>
            <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.45)' }}>{SITE}</p>
          </div>
        </footer>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import {
  MessageSquare, Wifi, WifiOff, RefreshCw, Send, Plus, Trash2,
  CheckCircle, Smartphone, RotateCcw,
} from 'lucide-react'

interface GrupoConfig {
  jid: string
  nome: string
  modalidade: string
}

interface WhatsAppStatus {
  conectado: boolean
  qr: string | null
}

const MODALIDADES = ['Lotofácil', 'Mega-Sena', 'Quina', 'Dupla Sena', 'Todas']

export default function WhatsAppPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [status, setStatus]               = useState<WhatsAppStatus>({ conectado: false, qr: null })
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [grupos, setGrupos]               = useState<GrupoConfig[]>([])
  const [novoGrupo, setNovoGrupo]         = useState({ jid: '', nome: '', modalidade: 'Todas' })
  const [testando, setTestando]           = useState<string | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/dashboard')
    })
  }, [router])

  const fetchStatus = useCallback(async () => {
    try {
      const [sRes, qrRes] = await Promise.all([
        fetch('/api/whatsapp-status'),
        fetch('/api/whatsapp-qr'),
      ])
      const s  = await sRes.json()
      const qr = await qrRes.json()
      setStatus({ conectado: s.conectado, qr: qr.qr || null })
    } catch {
      setStatus({ conectado: false, qr: null })
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const saved = localStorage.getItem('wa_grupos')
    if (saved) setGrupos(JSON.parse(saved))
  }, [fetchStatus])

  // Polling a cada 4 segundos enquanto não conectado (QR expira ~20s)
  useEffect(() => {
    if (!status.conectado) {
      const id = setInterval(fetchStatus, 4000)
      return () => clearInterval(id)
    }
  }, [status.conectado, fetchStatus])

  function salvarGrupos(lista: GrupoConfig[]) {
    setGrupos(lista)
    localStorage.setItem('wa_grupos', JSON.stringify(lista))
  }

  function adicionarGrupo() {
    if (!novoGrupo.jid.trim())  { toast('Informe o JID do grupo', 'error');  return }
    if (!novoGrupo.nome.trim()) { toast('Informe o nome do grupo', 'error'); return }
    salvarGrupos([...grupos, { ...novoGrupo, jid: novoGrupo.jid.trim(), nome: novoGrupo.nome.trim() }])
    setNovoGrupo({ jid: '', nome: '', modalidade: 'Todas' })
    toast('Grupo adicionado!', 'success')
  }

  function removerGrupo(jid: string) {
    salvarGrupos(grupos.filter(g => g.jid !== jid))
    toast('Grupo removido', 'info')
  }

  async function testarGrupo(grupo: GrupoConfig) {
    if (!status.conectado) { toast('WhatsApp não conectado', 'error'); return }
    setTestando(grupo.jid)
    try {
      const res  = await fetch(`/api/whatsapp-teste?jid=${encodeURIComponent(grupo.jid)}&grupo=${encodeURIComponent(grupo.nome)}`)
      const data = await res.json()
      if (data.ok) toast(`Mensagem enviada para ${grupo.nome}!`, 'success')
      else toast(data.erro || 'Erro ao enviar', 'error')
    } catch {
      toast('Erro de conexão com o backend', 'error')
    } finally {
      setTestando(null)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp</h1>
        <p className="text-gray-500 mt-1">Gerencie a conexão e os grupos de notificação</p>
      </div>

      {/* Status */}
      <Card className={status.conectado ? 'border-green-200' : 'border-yellow-200'}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${status.conectado ? 'bg-green-100' : 'bg-yellow-100'}`}>
                {status.conectado
                  ? <Wifi className="h-5 w-5 text-green-700" />
                  : <WifiOff className="h-5 w-5 text-yellow-700" />}
              </div>
              <div>
                <CardTitle>Status da Conexão</CardTitle>
                <CardDescription>
                  {loadingStatus ? 'Verificando...' : status.conectado
                    ? 'WhatsApp conectado e funcionando'
                    : status.qr ? 'QR Code disponível — escaneie para conectar' : 'Aguardando QR Code...'}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={status.conectado ? 'success' : 'warning'}>
                {status.conectado ? 'Conectado' : status.qr ? 'QR Pronto' : 'Aguardando'}
              </Badge>
              <Button variant="ghost" size="icon" onClick={fetchStatus} title="Atualizar">
                <RefreshCw className={`h-4 w-4 ${loadingStatus ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Limpar sessão e gerar novo QR"
                onClick={async () => {
                  if (!confirm('Limpar sessão? Será necessário escanear o QR novamente.')) return
                  await fetch('/api/whatsapp-reiniciar', { method: 'POST' })
                  toast('Sessão reiniciada — aguarde o QR Code', 'info')
                  setTimeout(fetchStatus, 2000)
                }}
              >
                <RotateCcw className="h-4 w-4 text-orange-500" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* QR Code */}
        {!status.conectado && (
          <CardContent>
            {status.qr ? (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="p-3 bg-white border-2 border-gray-200 rounded-2xl shadow-inner shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={status.qr} alt="QR Code WhatsApp" className="w-56 h-56" />
                </div>
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2 text-green-700">
                    <Smartphone className="h-5 w-5" />
                    <span className="font-semibold">QR Code disponível!</span>
                  </div>
                  <ol className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-800 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">1</span>
                      Abra o WhatsApp no celular
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-800 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">2</span>
                      Vá em <strong>Configurações → Aparelhos conectados</strong>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-800 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">3</span>
                      Toque em <strong>Conectar aparelho</strong>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-blue-800 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">4</span>
                      Escaneie o QR ao lado
                    </li>
                  </ol>
                  <p className="text-xs text-gray-400">O QR atualiza automaticamente. Se expirar, clique em <strong>Atualizar</strong>.</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400 space-y-2">
                <WifiOff className="h-10 w-10 mx-auto opacity-40" />
                <p className="text-sm font-medium text-gray-600">Aguardando QR Code...</p>
                <p className="text-xs text-gray-400">
                  Certifique-se de que o servidor está rodando na pasta{' '}
                  <code className="bg-gray-100 px-1 rounded text-gray-600">loteria-app/</code>:
                </p>
                <code className="inline-block mt-1 bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-700 font-mono">
                  npm run start
                </code>
                <p className="text-xs text-gray-400 mt-2">
                  O QR aparecerá aqui e também no terminal do servidor.
                </p>
              </div>
            )}
          </CardContent>
        )}

        {/* Conectado */}
        {status.conectado && (
          <CardContent>
            <div className="flex items-center gap-3 text-green-700 bg-green-50 rounded-lg p-3">
              <CheckCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">WhatsApp pronto para enviar mensagens aos grupos configurados.</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Grupos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-700" />
            Grupos de Notificação
          </CardTitle>
          <CardDescription>Configure os grupos que receberão notificações automáticas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Adicionar Grupo</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome do Grupo</Label>
                <Input
                  placeholder="ex: Bolão Empresa"
                  value={novoGrupo.nome}
                  onChange={e => setNovoGrupo(prev => ({ ...prev, nome: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">JID do Grupo</Label>
                <Input
                  placeholder="120363xxx@g.us"
                  value={novoGrupo.jid}
                  onChange={e => setNovoGrupo(prev => ({ ...prev, jid: e.target.value }))}
                  className="text-sm font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Modalidade</Label>
                <select
                  value={novoGrupo.modalidade}
                  onChange={e => setNovoGrupo(prev => ({ ...prev, modalidade: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <Button size="sm" onClick={adicionarGrupo}>
              <Plus className="h-4 w-4" />
              Adicionar Grupo
            </Button>
            <p className="text-xs text-gray-400">
              O JID dos grupos aparece no terminal do servidor assim que o WhatsApp conectar.
            </p>
          </div>

          {grupos.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum grupo configurado ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {grupos.map(grupo => (
                <div
                  key={grupo.jid}
                  className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-200 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                    <MessageSquare className="h-5 w-5 text-green-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{grupo.nome}</p>
                    <p className="text-xs text-gray-400 font-mono truncate">{grupo.jid}</p>
                    <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-medium mt-0.5">
                      {grupo.modalidade}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => testarGrupo(grupo)}
                      loading={testando === grupo.jid}
                      disabled={!status.conectado}
                      title={status.conectado ? 'Enviar mensagem de teste' : 'WhatsApp desconectado'}
                    >
                      <Send className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removerGrupo(grupo.jid)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

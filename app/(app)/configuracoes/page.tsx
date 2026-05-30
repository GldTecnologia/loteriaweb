'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { Settings, Key, Plus, Trash2, Copy, CheckCircle, QrCode, XCircle } from 'lucide-react'
import { isAdminEmail } from '@/lib/auth'
import type { ChavePix, TokenAcesso } from '@/types'
import { v4 as uuidv4 } from 'uuid'
import { validarChavePix, DICA_PIX, type TipoPix } from '@/lib/validarPix'

const TIPO_PIX = ['CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA'] as const

export default function ConfiguracoesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [chavePix, setChavePix] = useState<ChavePix | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!isAdminEmail(data.user?.email)) router.replace('/dashboard')
    })
  }, [router])
  const [tokens, setTokens] = useState<TokenAcesso[]>([])
  const [loadingPix, setLoadingPix] = useState(false)
  const [formPix, setFormPix] = useState({ chave: '', tipo: 'EMAIL', nome: '', cidade: '' })
  const [formToken, setFormToken] = useState({ nome: '', dias: '30' })
  const [novoToken, setNovoToken] = useState('')

  async function loadData() {
    const supabase = createClient()
    const [pixRes, tokensRes] = await Promise.all([
      supabase.from('chave_pix').select('*').limit(1).single(),
      supabase.from('tokens_acesso').select('*').order('created_at', { ascending: false }),
    ])
    if (pixRes.data) {
      setChavePix(pixRes.data)
      setFormPix({
        chave: pixRes.data.chave ?? '',
        tipo: pixRes.data.tipo ?? 'EMAIL',
        nome: pixRes.data.nome ?? '',
        cidade: pixRes.data.cidade ?? '',
      })
    }
    setTokens(tokensRes.data || [])
  }

  useEffect(() => { loadData() }, [])

  const validacaoPix = formPix.chave.trim()
    ? validarChavePix(formPix.tipo as TipoPix, formPix.chave)
    : null

  async function salvarPix() {
    if (!formPix.nome.trim())   { toast('Informe o nome do recebedor', 'error'); return }
    if (!formPix.cidade.trim()) { toast('Informe a cidade', 'error'); return }
    const v = validarChavePix(formPix.tipo as TipoPix, formPix.chave)
    if (!v.valido) { toast(v.erro ?? 'Chave PIX inválida', 'error'); return }
    // Salva a chave já normalizada (ex: +5511... para telefone)
    const dadosSalvar = { ...formPix, chave: v.formatado ?? formPix.chave }
    setLoadingPix(true)
    const supabase = createClient()
    if (chavePix) {
      await supabase.from('chave_pix').update(dadosSalvar).eq('id', chavePix.id)
    } else {
      await supabase.from('chave_pix').insert(dadosSalvar)
    }
    toast('Chave PIX salva!', 'success')
    setLoadingPix(false)
    loadData()
  }

  async function gerarToken() {
    if (!formToken.nome.trim()) { toast('Informe o nome do portador', 'error'); return }
    const supabase = createClient()
    const token = uuidv4()
    const dias = parseInt(formToken.dias) || 30
    const expira = new Date()
    expira.setDate(expira.getDate() + dias)

    const { error } = await supabase.from('tokens_acesso').insert({
      nome: formToken.nome.trim(),
      token,
      dias_validade: dias,
      expira_em: expira.toISOString(),
      ativo: true,
    })

    if (error) { toast('Erro ao gerar token', 'error'); return }
    setNovoToken(token)
    setFormToken({ nome: '', dias: '30' })
    toast('Token gerado!', 'success')
    loadData()
  }

  async function revogarToken(id: number) {
    const supabase = createClient()
    await supabase.from('tokens_acesso').update({ ativo: false }).eq('id', id)
    toast('Token revogado', 'info')
    loadData()
  }

  async function copyToken(t: string) {
    await navigator.clipboard.writeText(t)
    toast('Token copiado!', 'success')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500 mt-1">Gerencie chave PIX e tokens de acesso</p>
      </div>

      {/* Chave PIX */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <QrCode className="h-4 w-4 text-green-700" />
            </div>
            <div>
              <CardTitle>Chave PIX</CardTitle>
              <CardDescription>Usada para gerar QR codes de pagamento das cotas</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo da Chave</Label>
              <Select value={formPix.tipo} onValueChange={v => setFormPix(p => ({ ...p, tipo: v, chave: '' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_PIX.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Chave PIX</Label>
              <div className="relative">
                <Input
                  placeholder={DICA_PIX[formPix.tipo as TipoPix]}
                  value={formPix.chave}
                  onChange={e => setFormPix(p => ({ ...p, chave: e.target.value }))}
                  className={
                    validacaoPix
                      ? validacaoPix.valido
                        ? 'border-green-500 pr-9'
                        : 'border-red-400 pr-9'
                      : ''
                  }
                />
                {validacaoPix && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    {validacaoPix.valido
                      ? <CheckCircle className="h-4 w-4 text-green-600" />
                      : <XCircle className="h-4 w-4 text-red-500" />}
                  </span>
                )}
              </div>
              {validacaoPix && !validacaoPix.valido && (
                <p className="text-xs text-red-500">{validacaoPix.erro}</p>
              )}
              {validacaoPix?.valido && validacaoPix.formatado && validacaoPix.formatado !== formPix.chave && (
                <p className="text-xs text-green-600">Será salvo como: <strong>{validacaoPix.formatado}</strong></p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Nome do Recebedor</Label>
              <Input
                placeholder="Nome completo"
                value={formPix.nome}
                onChange={e => setFormPix(p => ({ ...p, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input
                placeholder="Cidade"
                value={formPix.cidade}
                onChange={e => setFormPix(p => ({ ...p, cidade: e.target.value }))}
              />
            </div>
          </div>
          <Button onClick={salvarPix} loading={loadingPix}>
            <CheckCircle className="h-4 w-4" />
            Salvar Chave PIX
          </Button>
        </CardContent>
      </Card>

      {/* Tokens de Acesso */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Key className="h-4 w-4 text-blue-700" />
            </div>
            <div>
              <CardTitle>Tokens de Acesso</CardTitle>
              <CardDescription>Tokens temporários para convidar participantes</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Gerar Novo Token</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs">Nome do Portador</Label>
                <Input
                  placeholder="Para quem é este token?"
                  value={formToken.nome}
                  onChange={e => setFormToken(p => ({ ...p, nome: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Validade (dias)</Label>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={formToken.dias}
                  onChange={e => setFormToken(p => ({ ...p, dias: e.target.value }))}
                />
              </div>
            </div>
            <Button size="sm" onClick={gerarToken}>
              <Plus className="h-4 w-4" />
              Gerar Token
            </Button>
          </div>

          {novoToken && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-green-800 mb-2">Token gerado! Compartilhe com o participante:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white border border-green-200 rounded-lg p-2 text-xs font-mono text-green-700 break-all">
                  {novoToken}
                </code>
                <Button size="sm" variant="outline" onClick={() => copyToken(novoToken)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {tokens.length > 0 && (
            <div className="space-y-2">
              {tokens.map(t => (
                <div
                  key={t.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${t.ativo && new Date(t.expira_em) > new Date() ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-gray-900">{t.nome}</p>
                      <Badge variant={t.ativo && new Date(t.expira_em) > new Date() ? 'success' : 'secondary'}>
                        {t.ativo && new Date(t.expira_em) > new Date() ? 'Ativo' : 'Expirado'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 font-mono truncate mt-0.5">{t.token}</p>
                    <p className="text-xs text-gray-400">Expira: {new Date(t.expira_em).toLocaleDateString('pt-BR')} · {t.dias_validade} dias</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => copyToken(t.token)} title="Copiar token">
                      <Copy className="h-4 w-4 text-blue-500" />
                    </Button>
                    {t.ativo && (
                      <Button size="sm" variant="ghost" onClick={() => revogarToken(t.id)} title="Revogar">
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    )}
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

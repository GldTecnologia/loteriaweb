'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import Link from 'next/link'
import { Layers, Plus, Calendar, DollarSign, Hash, CheckCircle, XCircle, Lock, RefreshCw, Trash2, AlertTriangle } from 'lucide-react'
import { formatBRL, formatDate } from '@/lib/utils'
import { isAdminEmail } from '@/lib/auth'
import type { Bolao, StatusBolao } from '@/types'

const STATUS_CONFIG: Record<StatusBolao, { label: string; variant: 'success' | 'warning' | 'secondary'; icon: React.ElementType }> = {
  aberto:    { label: 'Aberto',     variant: 'success',   icon: CheckCircle },
  encerrado: { label: 'Encerrado',  variant: 'secondary', icon: Lock        },
  sorteado:  { label: 'Sorteado',   variant: 'warning',   icon: Layers      },
}

const MODALIDADE_COLOR: Record<string, string> = {
  'Lotofácil':  'bg-purple-100 text-purple-800 border-purple-200',
  'Mega-Sena':  'bg-green-100 text-green-800 border-green-200',
  'Quina':      'bg-blue-100 text-blue-800 border-blue-200',
  'Dupla Sena': 'bg-red-100 text-red-800 border-red-200',
}

export default function BoloesPage() {
  const { toast } = useToast()
  const [boloes, setBoloes] = useState<Bolao[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [sincronizando, setSincronizando] = useState<number | null>(null)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<number | null>(null)
  const [excluindo, setExcluindo] = useState<number | null>(null)

  async function load() {
    const supabase = createClient()
    const [sessionRes, boloesRes] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('boloes').select('*').order('created_at', { ascending: false }),
    ])
    setIsAdmin(isAdminEmail(sessionRes.data.user?.email))
    if (boloesRes.error) toast('Erro ao carregar bolões', 'error')
    setBoloes(boloesRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function alterarStatus(id: number, status: StatusBolao) {
    const supabase = createClient()
    const { error } = await supabase.from('boloes').update({ status }).eq('id', id)
    if (error) { toast('Erro ao atualizar status', 'error'); return }
    toast(status === 'encerrado' ? 'Bolão encerrado!' : 'Bolão reaberto!', 'success')
    load()
  }

  async function excluirBolao(id: number) {
    setExcluindo(id)
    const supabase = createClient()

    const { error: erroJogos } = await supabase.from('jogos').delete().eq('bolao_id', id)
    if (erroJogos) {
      toast('Erro ao excluir jogos do bolão', 'error')
      setExcluindo(null)
      return
    }

    const { error } = await supabase.from('boloes').delete().eq('id', id)
    if (error) {
      toast('Erro ao excluir bolão', 'error')
    } else {
      setBoloes(prev => prev.filter(b => b.id !== id))
      toast('Bolão e jogos excluídos!', 'info')
    }
    setExcluindo(null)
    setConfirmandoExclusao(null)
  }

  async function sincronizar(bolao: Bolao) {
    setSincronizando(bolao.id)
    try {
      const res = await fetch('/api/sincronizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bolao_id: bolao.id }),
      })
      const json = await res.json()
      if (!res.ok) { toast(json.error || 'Erro ao sincronizar', 'error'); return }
      toast(json.mensagem, 'success')
    } catch {
      toast('Erro ao sincronizar', 'error')
    } finally {
      setSincronizando(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Bolões</h1>
          <p className="text-gray-500 mt-0.5 text-sm">Gerencie os bolões abertos e encerrados</p>
        </div>
        {isAdmin && (
          <Link href="/boloes/novo">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Novo Bolão
            </Button>
          </Link>
        )}
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 h-40 bg-gray-100 rounded-xl" />
            </Card>
          ))}
        </div>
      )}

      {!loading && boloes.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Layers className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700">Nenhum bolão cadastrado</h3>
            <p className="text-gray-500 mt-1 mb-6 text-sm">Crie o primeiro bolão para começar.</p>
            {isAdmin && (
              <Link href="/boloes/novo">
                <Button><Plus className="h-4 w-4" />Criar Primeiro Bolão</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {boloes.map(bolao => {
          const cfg = STATUS_CONFIG[bolao.status]
          const StatusIcon = cfg.icon
          const confirmando = confirmandoExclusao === bolao.id

          return (
            <Card key={bolao.id} className={bolao.status === 'aberto' ? 'border-green-200 shadow-md' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${MODALIDADE_COLOR[bolao.modalidade] || 'bg-gray-100 text-gray-700'}`}>
                      {bolao.modalidade}
                    </span>
                    <Badge variant={cfg.variant}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {cfg.label}
                    </Badge>
                  </div>

                  {/* Excluir — só admin */}
                  {isAdmin && (
                    confirmando ? (
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Excluir bolão e todos os jogos?
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            loading={excluindo === bolao.id}
                            onClick={() => excluirBolao(bolao.id)}
                            className="h-7 px-2 text-xs"
                          >
                            Sim, excluir
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmandoExclusao(null)}
                            className="h-7 px-2 text-xs"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmandoExclusao(bolao.id)}
                        className="h-7 px-2 text-gray-400 hover:text-red-500 shrink-0"
                        title="Excluir bolão"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )
                  )}
                </div>
                {bolao.descricao && (
                  <p className="text-sm text-gray-500 mt-1">{bolao.descricao}</p>
                )}
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Hash className="h-4 w-4 text-gray-400 shrink-0" />
                    <span>Concurso <strong className="text-gray-900">#{bolao.concurso}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                    <span>
                      {formatDate(bolao.data_sorteio)}
                      {bolao.hora_sorteio && (
                        <span className="ml-1 text-gray-400">às {bolao.hora_sorteio.slice(0, 5)}</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Layers className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-green-700 font-semibold">{formatBRL(bolao.valor_premio_inicial)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <DollarSign className="h-4 w-4 text-gray-400 shrink-0" />
                    <span>Cota: <strong className="text-blue-700">{formatBRL(bolao.valor_cota)}</strong></span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 flex-wrap">
                  {bolao.status === 'aberto' ? (
                    <>
                      <Link href={`/jogos?bolao=${bolao.id}`} className="flex-1 min-w-[120px]">
                        <Button variant="success" className="w-full" size="sm">
                          <Layers className="h-3.5 w-3.5" />
                          Incluir Jogos
                        </Button>
                      </Link>
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => alterarStatus(bolao.id, 'encerrado')}
                        >
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                          Encerrar
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      {isAdmin && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => alterarStatus(bolao.id, 'aberto')}
                          >
                            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                            Reabrir
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            loading={sincronizando === bolao.id}
                            onClick={() => sincronizar(bolao)}
                          >
                            <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
                            Sincronizar
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

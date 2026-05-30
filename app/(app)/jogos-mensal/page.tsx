'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { isAdminEmail } from '@/lib/auth'
import { CalendarDays, RefreshCw, Search, CheckSquare, Square, Ticket } from 'lucide-react'
import type { Jogo, Bolao, Modalidade } from '@/types'

const DIAS_DEFAULT: Record<string, string> = {
  'Mega-Sena':  '4',
  'Lotofácil':  '6',
  'Quina':      '5',
  'Dupla Sena': '4',
}

const VALOR_DEFAULT: Record<string, string> = {
  'Mega-Sena':  '6.00',
  'Lotofácil':  '3.00',
  'Quina':      '2.50',
  'Dupla Sena': '3.00',
}

interface Config {
  nome_grupo: string
  concurso_inicio: string
  concurso_fim: string
  qtd_teimosinha: string
  valor_aposta: string
  dias_sorteio: string
  especial: 'S' | 'N'
}

const CONFIG_INICIAL: Config = {
  nome_grupo:      '',
  concurso_inicio: '',
  concurso_fim:    '',
  qtd_teimosinha:  '1',
  valor_aposta:    '6.00',
  dias_sorteio:    '4',
  especial:        'S',
}

export default function AgendamentoConferenciaPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [userId, setUserId]         = useState<string | null>(null)
  const [boloes, setBoloes]         = useState<Bolao[]>([])
  const [bolaoSel, setBolaoSel]     = useState<string>('todos')
  const [jogos, setJogos]           = useState<Jogo[]>([])
  const [loadingJogos, setLoadingJogos] = useState(false)
  const [buscaParticipante, setBuscaParticipante] = useState('')
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set())
  const [config, setConfig]         = useState<Config>(CONFIG_INICIAL)
  const [buscandoConcurso, setBuscandoConcurso] = useState(false)
  const [agendando, setAgendando]   = useState(false)

  // Auth check
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!isAdminEmail(data.user?.email)) router.replace('/dashboard')
      else setUserId(data.user!.id)
    })
  }, [router])

  // Carrega bolões para o filtro
  useEffect(() => {
    createClient()
      .from('boloes')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setBoloes(data || []))
  }, [])

  // Carrega jogos quando muda o bolão selecionado
  useEffect(() => {
    async function loadJogos() {
      setLoadingJogos(true)
      setSelecionados(new Set())

      const supabase = createClient()
      let query = supabase.from('jogos').select('*, bolao:boloes(*)').order('participante')

      if (bolaoSel !== 'todos') query = query.eq('bolao_id', bolaoSel)

      const { data } = await query
      setJogos((data as Jogo[]) || [])
      setLoadingJogos(false)
    }
    loadJogos()
  }, [bolaoSel])

  // Auto-preenche config quando muda o bolão selecionado
  useEffect(() => {
    if (bolaoSel === 'todos') return
    const bolao = boloes.find(b => String(b.id) === bolaoSel)
    if (!bolao) return
    setConfig(prev => ({
      ...prev,
      concurso_inicio: bolao.concurso,
      concurso_fim:    prev.concurso_fim || bolao.concurso,
      dias_sorteio:    DIAS_DEFAULT[bolao.modalidade] ?? prev.dias_sorteio,
      valor_aposta:    VALOR_DEFAULT[bolao.modalidade] ?? prev.valor_aposta,
    }))
  }, [bolaoSel, boloes])

  // Busca concurso do bolão ativo da modalidade predominante
  async function autoFillConcurso() {
    const modalidade = jogosFiltrados[0]?.modalidade ?? jogosFiltrados[0]?.bolao?.modalidade
    if (!modalidade) { toast('Selecione um bolão primeiro', 'info'); return }

    setBuscandoConcurso(true)
    const { data } = await createClient()
      .from('boloes')
      .select('concurso')
      .eq('modalidade', modalidade as Modalidade)
      .eq('status', 'aberto')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data?.concurso) {
      setConfig(prev => ({
        ...prev,
        concurso_inicio: data.concurso,
        concurso_fim:    prev.concurso_fim || data.concurso,
      }))
      toast(`Concurso ${data.concurso} carregado`, 'success')
    } else {
      toast('Nenhum bolão aberto encontrado', 'info')
    }
    setBuscandoConcurso(false)
  }

  const jogosFiltrados = useMemo(() => {
    if (!buscaParticipante.trim()) return jogos
    return jogos.filter(j =>
      j.participante.toLowerCase().includes(buscaParticipante.toLowerCase())
    )
  }, [jogos, buscaParticipante])

  function toggleTodos() {
    if (selecionados.size === jogosFiltrados.length) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(jogosFiltrados.map(j => j.id)))
    }
  }

  function toggleJogo(id: number) {
    setSelecionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function agendar() {
    if (!userId) return
    if (!config.nome_grupo.trim()) { toast('Informe o nome do grupo', 'error'); return }
    if (!config.concurso_inicio)  { toast('Informe o concurso início', 'error'); return }
    if (!config.concurso_fim)     { toast('Informe o concurso fim', 'error'); return }
    if (selecionados.size === 0)  { toast('Selecione ao menos um jogo', 'error'); return }

    const jogosParaAgendar = jogosFiltrados.filter(j => selecionados.has(j.id))

    setAgendando(true)
    try {
      const registros = jogosParaAgendar.map(j => ({
        modalidade:      j.modalidade,
        nome_grupo:      config.nome_grupo.trim().toUpperCase(),
        apostas:         j.aposta,
        qtd_teimosinha:  parseInt(config.qtd_teimosinha) || 1,
        concurso_inicio: parseInt(config.concurso_inicio),
        concurso_ultimo: 0,
        concurso_fim:    parseInt(config.concurso_fim),
        valor_aposta:    parseFloat(config.valor_aposta),
        user_id:         userId,
        dias_sorteio:    config.dias_sorteio || null,
        especial:        config.especial,
        status:          'A',
        apostador:       j.participante,
      }))

      const { error } = await createClient().from('jogos_mensal').insert(registros)
      if (error) throw error

      toast(`${registros.length} jogo(s) agendados para conferência!`, 'success')
      setSelecionados(new Set())
    } catch (err: unknown) {
      toast((err as Error).message || 'Erro ao agendar', 'error')
    } finally {
      setAgendando(false)
    }
  }

  const todosSelecionados =
    jogosFiltrados.length > 0 && selecionados.size === jogosFiltrados.length

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-blue-700" />
          Agendamento de Conferência
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Selecione jogos existentes e agende-os para conferência de resultados
        </p>
      </div>

      {/* ── Parâmetros do agendamento ───────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parâmetros do Agendamento</CardTitle>
          <CardDescription>Configurações aplicadas a todos os jogos selecionados</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Grupo / Concurso início / Concurso fim / Teimosinha */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5 sm:col-span-1">
              <Label>Nome do Grupo</Label>
              <Input
                placeholder="Ex: MEU, FAMILIA"
                value={config.nome_grupo}
                onChange={e => setConfig(p => ({ ...p, nome_grupo: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Concurso Início</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Ex: 3002"
                  value={config.concurso_inicio}
                  onChange={e => setConfig(p => ({ ...p, concurso_inicio: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Buscar do bolão ativo"
                  loading={buscandoConcurso}
                  onClick={autoFillConcurso}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Concurso Fim</Label>
              <Input
                type="number"
                placeholder="Ex: 3002"
                value={config.concurso_fim}
                onChange={e => setConfig(p => ({ ...p, concurso_fim: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Teimosinha <span className="text-gray-400 font-normal">(1–24)</span></Label>
              <Input
                type="number"
                min="1"
                max="24"
                value={config.qtd_teimosinha}
                onChange={e => setConfig(p => ({ ...p, qtd_teimosinha: e.target.value }))}
              />
            </div>
          </div>

          {/* Valor / Dias / Especial */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Valor Aposta (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={config.valor_aposta}
                onChange={e => setConfig(p => ({ ...p, valor_aposta: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Dias Sorteio</Label>
              <Input
                value={config.dias_sorteio}
                onChange={e => setConfig(p => ({ ...p, dias_sorteio: e.target.value }))}
                placeholder="Ex: 4"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Especial — enviar para conferência</Label>
              <div className="flex gap-2 h-10">
                <button
                  type="button"
                  onClick={() => setConfig(p => ({ ...p, especial: 'S' }))}
                  className={`flex-1 rounded-lg text-sm font-semibold border transition-all ${
                    config.especial === 'S'
                      ? 'bg-yellow-400 border-yellow-500 text-yellow-900'
                      : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  ★ Sim — vai para conferência
                </button>
                <button
                  type="button"
                  onClick={() => setConfig(p => ({ ...p, especial: 'N' }))}
                  className={`flex-1 rounded-lg text-sm font-semibold border transition-all ${
                    config.especial === 'N'
                      ? 'bg-gray-200 border-gray-400 text-gray-700'
                      : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  ☆ Não
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Seleção de jogos ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base">Selecionar Jogos</CardTitle>
              <CardDescription>Jogos da tabela de apostas para agendar</CardDescription>
            </div>
            {selecionados.size > 0 && (
              <Button onClick={agendar} loading={agendando}>
                <CalendarDays className="h-4 w-4" />
                Agendar {selecionados.size} jogo{selecionados.size > 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">

          {/* Filtros */}
          <div className="flex gap-3 flex-wrap">
            <Select value={bolaoSel} onValueChange={setBolaoSel}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrar por bolão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os bolões</SelectItem>
                {boloes.map(b => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.modalidade} #{b.concurso}
                    {b.status === 'aberto' && ' ●'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Buscar participante..."
                value={buscaParticipante}
                onChange={e => setBuscaParticipante(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Tabela */}
          {loadingJogos ? (
            <div className="text-center py-10 text-gray-400">Carregando jogos...</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs">
                    <th className="px-3 py-3 w-10">
                      <button onClick={toggleTodos} className="text-blue-600 hover:text-blue-800 transition-colors">
                        {todosSelecionados
                          ? <CheckSquare className="h-4 w-4" />
                          : <Square className="h-4 w-4 text-gray-400" />
                        }
                      </button>
                    </th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-600">Participante</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-600">Modalidade</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-600">Aposta</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Bolão</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-600">Pag.</th>
                  </tr>
                </thead>
                <tbody>
                  {jogosFiltrados.map(j => {
                    const sel = selecionados.has(j.id)
                    return (
                      <tr
                        key={j.id}
                        onClick={() => toggleJogo(j.id)}
                        className={`border-b border-gray-100 cursor-pointer transition-colors ${
                          sel ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-3 py-2.5 text-center">
                          {sel
                            ? <CheckSquare className="h-4 w-4 text-blue-600 mx-auto" />
                            : <Square className="h-4 w-4 text-gray-300 mx-auto" />
                          }
                        </td>
                        <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                          {j.participante}
                          <span className="text-gray-400 font-mono text-xs ml-1">#{j.sequencia}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{j.modalidade}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-700">{j.aposta}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                          {j.bolao ? `${j.bolao.modalidade} #${j.bolao.concurso}` : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant={j.status_pagamento === 'pago' ? 'success' : 'warning'}>
                            {j.status_pagamento === 'pago' ? 'Pago' : 'Pendente'}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                  {jogosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-400">
                        <Ticket className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhum jogo encontrado</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Rodapé com contadores */}
          {jogosFiltrados.length > 0 && (
            <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
              <span>{jogosFiltrados.length} jogo{jogosFiltrados.length > 1 ? 's' : ''} exibido{jogosFiltrados.length > 1 ? 's' : ''}</span>
              {selecionados.size > 0 && (
                <span className="font-semibold text-blue-700">
                  {selecionados.size} selecionado{selecionados.size > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

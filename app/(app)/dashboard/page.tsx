'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Layers, Ticket, CheckCircle, ArrowRight, FileText } from 'lucide-react'
import { FaClover } from 'react-icons/fa6'
import Link from 'next/link'
import { formatBRL, formatDate } from '@/lib/utils'
import { isAdminEmail } from '@/lib/auth'
import type { Bolao } from '@/types'

interface BolaoComStats {
  bolao: Bolao
  totalJogos: number
  totalArrecadado: number
  totalParticipantes: number
}

interface Stats {
  boloesAbertos: number
  boloes: BolaoComStats[]
}

const MODALIDADE_COR: Record<string, string> = {
  'Lotofácil':  '#91278F',
  'Mega-Sena':  '#00A651',
  'Quina':      '#2E3192',
  'Dupla Sena': '#A62B43',
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ boloesAbertos: 0, boloes: [] })
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [boloesRes, jogosRes, userRes] = await Promise.all([
        supabase.from('boloes').select('*').eq('status', 'aberto').order('created_at', { ascending: false }),
        supabase.from('jogos').select('id, bolao_id, participante'),
        supabase.auth.getUser(),
      ])
      setIsAdmin(isAdminEmail(userRes.data.user?.email))
      const boloes = boloesRes.data || []
      const jogos  = jogosRes.data || []
      setStats({
        boloesAbertos: boloes.length,
        boloes: boloes.map(b => {
          const jogosDoBolao = jogos.filter(j => Number(j.bolao_id) === Number(b.id))
          const n = jogosDoBolao.length
          const qtdJogos = Number(b.qtd_jogos) || 1
          const totalParticipantes = Math.floor(n / qtdJogos)
          // Arrecadado = participantes únicos × valor_cota (cada participante paga 1 cota independente de quantos jogos tem)
          const participantesUnicos = new Set(jogosDoBolao.map(j => j.participante?.toLowerCase())).size
          return { bolao: b, totalJogos: n, totalArrecadado: participantesUnicos * Number(b.valor_cota || 0), totalParticipantes }
        }),
      })
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-0.5 text-sm">Visão geral dos bolões ativos</p>
        </div>
        {!loading && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 shrink-0">
            <Layers className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            <div>
              <p className="text-xs text-gray-500 font-medium leading-none mb-0.5">Bolões em Andamento</p>
              <p className="text-lg sm:text-xl font-black text-gray-900 leading-none">{stats.boloesAbertos}</p>
            </div>
          </div>
        )}
      </div>

      {/* Cards dos bolões */}
      {!loading && stats.boloes.length > 0 && (
        <div className="space-y-3">
          {stats.boloes.map(b => {
            const cor = MODALIDADE_COR[b.bolao.modalidade] ?? '#6B7280'
            const sorteio = formatDate(b.bolao.data_sorteio) + (b.bolao.hora_sorteio ? ` · ${b.bolao.hora_sorteio}` : '')
            return (
              <Card key={b.bolao.id} className="overflow-hidden" style={{ border: `1.5px solid ${cor}30` }}>

                {/* Banner compacto */}
                <div
                  className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3"
                  style={{ background: cor }}
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <FaClover
                      className="text-xl sm:text-2xl shrink-0"
                      style={{ color: 'rgba(255,255,255,0.85)' }}
                    />
                    <h2 className="text-white text-base sm:text-xl font-black tracking-tight leading-none truncate">
                      {b.bolao.modalidade}
                    </h2>
                    <span
                      className="hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold shrink-0"
                      style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
                      {b.bolao.status === 'aberto' ? 'Aberto' : b.bolao.status}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className="text-xs font-bold uppercase tracking-widest leading-none mb-1"
                      style={{ color: 'rgba(255,255,255,0.6)' }}
                    >
                      Concurso
                    </p>
                    <p className="text-white font-black text-2xl sm:text-3xl leading-none">
                      #{b.bolao.concurso}
                    </p>
                  </div>
                </div>

                {/* Stats + ações */}
                <CardContent className="px-4 sm:px-5 py-3">
                  {/* Chips de stats */}
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {[
                      { label: 'Sorteio',  value: sorteio },
                      { label: 'Prêmio',   value: formatBRL(b.bolao.valor_premio_inicial) },
                      { label: 'Cota',     value: formatBRL(b.bolao.valor_cota) },
                      { label: 'Jogos',         value: String(b.totalJogos) },
                      { label: 'Participantes', value: String(b.totalParticipantes) },
                      { label: 'Arrecad.',      value: formatBRL(b.totalArrecadado) },
                    ].map(item => (
                      <div
                        key={item.label}
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs"
                        style={{ background: `${cor}0d` }}
                      >
                        <span className="text-gray-400 font-medium">{item.label}</span>
                        <span className="font-bold text-gray-800">{item.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Botões */}
                  <div className="flex gap-2">
                    <Link href={`/jogos?bolao=${b.bolao.id}`} className="flex-1 sm:flex-none">
                      <Button size="sm" className="w-full sm:w-auto" style={{ background: cor, borderColor: cor }}>
                        <Ticket className="h-3.5 w-3.5" />
                        Incluir Jogos
                      </Button>
                    </Link>
                    {isAdmin && (
                      <Link href="/boloes" className="flex-1 sm:flex-none">
                        <Button size="sm" variant="outline" className="w-full sm:w-auto">Ver Bolões</Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && stats.boloes.length === 0 && (
        <Card>
          <CardContent className="p-10 sm:p-12 text-center">
            <Layers className="h-10 w-10 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-base sm:text-lg font-semibold text-gray-700">Nenhum bolão aberto</h3>
            <p className="text-gray-500 mt-1 mb-6 text-sm">Crie um bolão para começar a receber apostas.</p>
            <Link href="/boloes/novo">
              <Button><Layers className="h-4 w-4" />Criar Bolão</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Atalhos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          ...(isAdmin ? [{ href: '/boloes', label: 'Gerenciar Bolões', desc: 'Abrir, encerrar e acompanhar', icon: Layers }] : []),
          { href: '/conferencia', label: 'Conferir Resultados', desc: 'Verificar números sorteados', icon: CheckCircle },
          ...(!isAdmin ? [{ href: '/relatorios', label: 'Relatórios', desc: 'Consultar jogos e pagamentos', icon: FileText }] : []),
        ].map(item => (
          <Link key={item.href} href={item.href}>
            <Card className="hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors shrink-0">
                    <item.icon className="h-5 w-5 text-blue-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                    <p className="text-xs text-gray-500 truncate">{item.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 ml-auto shrink-0 group-hover:text-blue-400 transition-colors" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { FileText, Download, Search, CheckCircle2, RotateCcw } from 'lucide-react'
import { formatBRL, formatDate } from '@/lib/utils'
import type { Jogo } from '@/types'

const MODALIDADE_COR: Record<string, string> = {
  'Lotofácil':  '#91278F',
  'Mega-Sena':  '#00A651',
  'Quina':      '#2E3192',
  'Dupla Sena': '#A62B43',
}

export default function RelatoriosPage() {
  const { toast } = useToast()
  const [jogos, setJogos] = useState<Jogo[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [atualizando, setAtualizando] = useState<number | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [sessionRes, jogosRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('jogos').select('*, bolao:boloes(*)').order('data', { ascending: false }).limit(200),
      ])

      setIsAdmin(!!sessionRes.data.user)
      setJogos((jogosRes.data as Jogo[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  async function alterarPagamento(id: number, status: 'pago' | 'pendente') {
    setAtualizando(id)
    const supabase = createClient()
    const { error } = await supabase.from('jogos').update({ status_pagamento: status }).eq('id', id)
    if (error) {
      toast('Erro ao atualizar pagamento', 'error')
    } else {
      setJogos(prev => prev.map(j => j.id === id ? { ...j, status_pagamento: status } : j))
      toast(status === 'pago' ? 'Pagamento confirmado!' : 'Pagamento estornado', status === 'pago' ? 'success' : 'info')
    }
    setAtualizando(null)
  }

  const jogosFiltrados = jogos
    .filter(j =>
      !busca ||
      j.participante.toLowerCase().includes(busca.toLowerCase()) ||
      j.sequencia.includes(busca) ||
      j.modalidade.toLowerCase().includes(busca.toLowerCase())
    )
    .sort((a, b) => {
      const nome = a.participante.localeCompare(b.participante, 'pt-BR', { sensitivity: 'base' })
      if (nome !== 0) return nome
      return Number(a.sequencia) - Number(b.sequencia)
    })

  async function exportarPDF() {
    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF()
    pdf.setFontSize(16)
    pdf.text('Relatório de Jogos', 14, 20)
    pdf.setFontSize(10)
    let y = 35
    jogosFiltrados.forEach((j, i) => {
      if (y > 270) { pdf.addPage(); y = 20 }
      pdf.text(`${i + 1}. ${j.participante} | Seq: ${j.sequencia} | ${j.modalidade} | ${j.aposta}`, 14, y)
      y += 7
    })
    pdf.save('relatorio-jogos.pdf')
    toast('PDF exportado!', 'success')
  }

  const colSpan = isAdmin ? 8 : 7

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-500 mt-0.5 text-sm">{jogosFiltrados.length} jogos encontrados</p>
        </div>
        <Button variant="outline" onClick={exportarPDF} size="sm">
          <Download className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por participante, sequência ou modalidade..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full h-10 pl-9 pr-4 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Seq</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Participante</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Modalidade</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Números</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Cota</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Pagamento</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Data</th>
                    {isAdmin && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {jogosFiltrados.map(j => (
                    <tr
                      key={j.id}
                      className={`border-b border-gray-100 transition-colors ${
                        j.status_pagamento === 'pago' ? 'bg-green-50/40' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-blue-700 whitespace-nowrap">#{j.sequencia}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{j.participante}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className="inline-block rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                          style={{ background: MODALIDADE_COR[j.modalidade] ?? '#6B7280' }}
                        >
                          {j.modalidade}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 max-w-[180px] truncate">{j.aposta}</td>
                      <td className="px-4 py-3 text-green-700 font-semibold whitespace-nowrap">
                        {j.bolao ? formatBRL(j.bolao.valor_cota) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant={j.status_pagamento === 'pago' ? 'success' : 'warning'}>
                          {j.status_pagamento === 'pago' ? 'Pago' : 'Pendente'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDate(j.data)}</td>
                      {isAdmin && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          {j.status_pagamento === 'pendente' ? (
                            <Button
                              size="sm"
                              variant="success"
                              loading={atualizando === j.id}
                              onClick={() => alterarPagamento(j.id, 'pago')}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Pago
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={atualizando === j.id}
                              onClick={() => alterarPagamento(j.id, 'pendente')}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Estornar
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {jogosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={colSpan} className="text-center py-12 text-gray-400">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Nenhum jogo encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

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

function cotaPorJogo(j: Jogo): number {
  return Number(j.bolao?.valor_cota ?? 0) / (Number(j.bolao?.qtd_jogos) || 1)
}

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

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const W = pdf.internal.pageSize.getWidth()
    const H = pdf.internal.pageSize.getHeight()
    const mL = 12, mR = 12, mB = 12
    const tableW = W - mL - mR

    const MODAL_RGB: Record<string, [number, number, number]> = {
      'Lotofácil':  [145, 39, 143],
      'Mega-Sena':  [0, 166, 81],
      'Quina':      [46, 49, 146],
      'Dupla Sena': [166, 43, 67],
    }

    // col widths must sum to tableW (273)
    const cols = [
      { label: 'SEQ',          w: 15 },
      { label: 'PARTICIPANTE', w: 60 },
      { label: 'MODALIDADE',   w: 33 },
      { label: 'NÚMEROS',      w: 85 },
      { label: 'COTA/JOGO',    w: 25 },
      { label: 'PAGAMENTO',    w: 25 },
      { label: 'DATA',         w: 30 },
    ]

    const rowH = 7
    const thH  = 9
    const barH = 20

    const drawBar = () => {
      pdf.setFillColor(15, 23, 42)
      pdf.rect(0, 0, W, barH, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('RELATÓRIO DE JOGOS', mL, 13)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7.5)
      pdf.setTextColor(148, 163, 184)
      const dt = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      pdf.text(`${dt}  ·  ${jogosFiltrados.length} jogos`, W - mR, 13, { align: 'right' })
    }

    const drawTH = (y: number) => {
      pdf.setFillColor(51, 65, 85)
      pdf.rect(mL, y, tableW, thH, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      let x = mL
      cols.forEach(c => { pdf.text(c.label, x + 3, y + 6); x += c.w })
      return y + thH
    }

    const drawRow = (j: Jogo, y: number, idx: number) => {
      if (j.status_pagamento === 'pago') {
        pdf.setFillColor(240, 253, 244)
      } else if (idx % 2 === 0) {
        pdf.setFillColor(248, 250, 252)
      } else {
        pdf.setFillColor(255, 255, 255)
      }
      pdf.rect(mL, y, tableW, rowH, 'F')
      pdf.setDrawColor(226, 232, 240)
      pdf.setLineWidth(0.1)
      pdf.line(mL, y + rowH, mL + tableW, y + rowH)

      const cy = y + rowH / 2 + 1.5
      let x = mL

      // Seq
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7.5)
      pdf.setTextColor(37, 99, 235)
      pdf.text(`#${j.sequencia}`, x + 3, cy)
      x += cols[0].w

      // Participante
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(17, 24, 39)
      const nome = j.participante.length > 26 ? j.participante.slice(0, 26) + '…' : j.participante
      pdf.text(nome, x + 3, cy)
      x += cols[1].w

      // Modalidade badge
      const rgb = MODAL_RGB[j.modalidade] ?? [107, 114, 128]
      pdf.setFillColor(rgb[0], rgb[1], rgb[2])
      pdf.roundedRect(x + 2, y + 1.5, cols[2].w - 4, rowH - 3, 1.5, 1.5, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(6.5)
      pdf.text(j.modalidade, x + cols[2].w / 2, cy, { align: 'center' })
      x += cols[2].w

      // Números
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(75, 85, 99)
      const num = j.aposta.length > 48 ? j.aposta.slice(0, 48) + '…' : j.aposta
      pdf.text(num, x + 3, cy)
      x += cols[3].w

      // Cota/Jogo
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7.5)
      pdf.setTextColor(22, 163, 74)
      pdf.text(j.bolao ? formatBRL(cotaPorJogo(j)) : '—', x + 3, cy)
      x += cols[4].w

      // Pagamento
      if (j.status_pagamento === 'pago') {
        pdf.setTextColor(22, 163, 74)
        pdf.text('Pago', x + 3, cy)
      } else {
        pdf.setTextColor(217, 119, 6)
        pdf.text('Pendente', x + 3, cy)
      }
      x += cols[5].w

      // Data
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(107, 114, 128)
      pdf.text(formatDate(j.data), x + 3, cy)
    }

    // ── Render ──────────────────────────────────────────────
    drawBar()
    let y = drawTH(barH)

    jogosFiltrados.forEach((j, i) => {
      if (y + rowH > H - mB - 20) {
        pdf.addPage()
        drawBar()
        y = drawTH(barH)
      }
      drawRow(j, y, i)
      y += rowH
    })

    // Summary bar
    y += 5
    if (y + 13 > H - mB) { pdf.addPage(); drawBar(); y = barH + 5 }
    const pagos    = jogosFiltrados.filter(j => j.status_pagamento === 'pago')
    const totalArr = pagos.reduce((s, j) => s + cotaPorJogo(j), 0)
    pdf.setFillColor(241, 245, 249)
    pdf.roundedRect(mL, y, tableW, 13, 2, 2, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(51, 65, 85)
    pdf.text(`Total de jogos: ${jogosFiltrados.length}`, mL + 6, y + 8.5)
    pdf.text(`Jogos pagos: ${pagos.length}`, mL + 70, y + 8.5)
    pdf.text(`Total arrecadado: ${formatBRL(totalArr)}`, mL + 140, y + 8.5)

    // Page numbers
    const total = (pdf as any).internal.pages.length - 1
    for (let p = 1; p <= total; p++) {
      pdf.setPage(p)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(148, 163, 184)
      pdf.text(`Página ${p} de ${total}`, W / 2, H - 4, { align: 'center' })
    }

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
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Cota/Jogo</th>
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
                        {j.bolao ? formatBRL(cotaPorJogo(j)) : '—'}
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

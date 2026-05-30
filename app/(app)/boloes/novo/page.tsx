'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { ArrowLeft, Layers } from 'lucide-react'
import Link from 'next/link'
import { MODALIDADE_CONFIG } from '@/types'
import type { Modalidade } from '@/types'

const MODALIDADES: Modalidade[] = ['Lotofácil', 'Mega-Sena', 'Quina', 'Dupla Sena']

export default function NovoBolaoPage() {
  const router = useRouter()

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/dashboard')
    })
  }, [router])
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    modalidade: '' as Modalidade | '',
    concurso: '',
    data_sorteio: '',
    hora_sorteio: '',
    valor_premio_inicial: '',
    valor_cota: '',
    descricao: '',
    qtd_jogos: '1',
    qtd_numeros: '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // Máscara BRL: converte dígitos digitados em "1.234.567,89"
  function handlePremioBRL(raw: string) {
    const digits = raw.replace(/\D/g, '')
    if (!digits) { set('valor_premio_inicial', ''); return }
    const num = parseInt(digits, 10) / 100
    const formatted = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    set('valor_premio_inicial', formatted)
  }

  function handleCotaBRL(raw: string) {
    const digits = raw.replace(/\D/g, '')
    if (!digits) { set('valor_cota', ''); return }
    const num = parseInt(digits, 10) / 100
    const formatted = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    set('valor_cota', formatted)
  }

  // Converte "1.234.567,89" → número para salvar no banco
  function premioNumerico(): number {
    return parseFloat(
      (form.valor_premio_inicial || '0').replace(/\./g, '').replace(',', '.')
    ) || 0
  }

  function cotaNumerica(): number {
    return parseFloat(
      (form.valor_cota || '0').replace(/\./g, '').replace(',', '.')
    ) || 0
  }

  function handleModalidade(modalidade: Modalidade) {
    const minQtd = MODALIDADE_CONFIG[modalidade].minQtd
    setForm(prev => ({
      ...prev,
      modalidade,
      qtd_numeros: String(minQtd),
    }))
  }

  const quantidadesDisponiveis = form.modalidade
    ? MODALIDADE_CONFIG[form.modalidade as Modalidade].quantidades
    : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.modalidade) { toast('Selecione a modalidade', 'error'); return }
    if (!form.concurso.trim()) { toast('Informe o número do concurso', 'error'); return }
    if (!form.data_sorteio) { toast('Informe a data do sorteio', 'error'); return }
    if (!form.valor_cota || cotaNumerica() <= 0) { toast('Informe o valor da cota', 'error'); return }
    if (!form.qtd_numeros) { toast('Informe a quantidade de números por jogo', 'error'); return }
    if (!form.qtd_jogos || Number(form.qtd_jogos) < 1) { toast('Informe a quantidade de jogos', 'error'); return }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase.from('boloes').insert({
        modalidade: form.modalidade,
        concurso: form.concurso.trim(),
        data_sorteio: form.data_sorteio,
        valor_premio_inicial: premioNumerico(),
        valor_cota: cotaNumerica(),
        qtd_jogos: Number(form.qtd_jogos),
        qtd_numeros: Number(form.qtd_numeros),
        hora_sorteio: form.hora_sorteio || null,
        descricao: form.descricao.trim() || null,
        status: 'aberto',
        created_by: user?.id || null,
      })

      if (error) throw error
      toast('Bolão criado com sucesso!', 'success')
      router.push('/boloes')
    } catch (err: unknown) {
      toast((err as Error).message || 'Erro ao criar bolão', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/boloes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo Bolão</h1>
          <p className="text-gray-500">Configure o bolão para receber apostas</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Layers className="h-4 w-4 text-blue-700" />
            </div>
            <div>
              <CardTitle>Dados do Bolão</CardTitle>
              <CardDescription>Preencha as informações do concurso</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Modalidade + Concurso */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Modalidade *</Label>
                <Select value={form.modalidade} onValueChange={v => handleModalidade(v as Modalidade)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a modalidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODALIDADES.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Número do Concurso *</Label>
                <Input
                  placeholder="ex: 3200"
                  value={form.concurso}
                  onChange={e => set('concurso', e.target.value)}
                />
              </div>
            </div>

            {/* Configuração dos jogos */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
              <p className="text-sm font-semibold text-gray-700">Configuração dos Jogos</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Números por jogo *</Label>
                  <Select
                    value={form.qtd_numeros}
                    onValueChange={v => set('qtd_numeros', v)}
                    disabled={!form.modalidade}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={form.modalidade ? 'Selecione' : 'Selecione a modalidade antes'} />
                    </SelectTrigger>
                    <SelectContent>
                      {quantidadesDisponiveis.map(q => (
                        <SelectItem key={q} value={String(q)}>
                          {q} números {q === MODALIDADE_CONFIG[form.modalidade as Modalidade]?.minQtd ? '(mínimo)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-400">Quantidade de números em cada aposta</p>
                </div>

                <div className="space-y-1.5">
                  <Label>Jogos por participante *</Label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    placeholder="ex: 6"
                    value={form.qtd_jogos}
                    onChange={e => set('qtd_jogos', e.target.value)}
                  />
                  <p className="text-xs text-gray-400">Máximo de jogos por pessoa</p>
                </div>
              </div>

              {form.qtd_numeros && form.qtd_jogos && (
                <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  Cada participante poderá incluir até <strong>{form.qtd_jogos} jogo{Number(form.qtd_jogos) > 1 ? 's' : ''}</strong> de <strong>{form.qtd_numeros} números</strong> — sem possibilidade de alterar na hora de incluir.
                </div>
              )}
            </div>

            {/* Data e Hora do sorteio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Data do Sorteio *</Label>
                <Input
                  type="date"
                  value={form.data_sorteio}
                  onChange={e => set('data_sorteio', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Horário do Sorteio</Label>
                <Input
                  type="time"
                  value={form.hora_sorteio}
                  onChange={e => set('hora_sorteio', e.target.value)}
                />
                <p className="text-xs text-gray-400">Opcional — ex: 20:00</p>
              </div>
            </div>

            {/* Valores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Prêmio Estimado</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500 pointer-events-none">R$</span>
                  <Input
                    inputMode="numeric"
                    placeholder="0,00"
                    value={form.valor_premio_inicial}
                    onChange={e => handlePremioBRL(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-gray-400">Prêmio principal estimado da modalidade</p>
              </div>

              <div className="space-y-1.5">
                <Label>Valor da Cota *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500 pointer-events-none">R$</span>
                  <Input
                    inputMode="numeric"
                    placeholder="0,00"
                    value={form.valor_cota}
                    onChange={e => handleCotaBRL(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-gray-400">Quanto cada participante paga</p>
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label>Descrição (opcional)</Label>
              <Input
                placeholder="ex: Bolão da empresa - Lotofácil 3200"
                value={form.descricao}
                onChange={e => set('descricao', e.target.value)}
              />
            </div>

            {/* Resumo */}
            {form.modalidade && form.valor_cota && form.qtd_numeros && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                <strong>Resumo:</strong> Bolão {form.modalidade}
                {form.concurso && ` · Concurso #${form.concurso}`}
                {form.data_sorteio && ` · Sorteio ${new Date(form.data_sorteio + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                {` · ${form.qtd_jogos} jogo${Number(form.qtd_jogos) > 1 ? 's' : ''} de ${form.qtd_numeros} números`}
                {form.valor_cota && ` · R$ ${Number(form.valor_cota).toFixed(2)} por cota`}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={loading} size="lg" className="flex-1">
                <Layers className="h-4 w-4" />
                Criar Bolão
              </Button>
              <Link href="/boloes">
                <Button type="button" variant="outline" size="lg">
                  Cancelar
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

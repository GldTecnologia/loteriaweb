'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { NumberPicker } from '@/components/NumberPicker'
import { useToast } from '@/components/ui/toast'
import { Ticket, Trash2, Plus, CheckCircle, Shuffle, ShoppingCart, AlertCircle, Layers, QrCode, XCircle } from 'lucide-react'
import { FaClover } from 'react-icons/fa6'
import { TermosModal } from '@/components/TermosModal'
import { pad2, pad3, numerosToAposta, formatBRL, formatDate } from '@/lib/utils'
import { MODALIDADE_CONFIG } from '@/types'
import type { Bolao, Modalidade, JogoStaging } from '@/types'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { v4 as uuidv4 } from 'uuid'
import { validarChavePixAuto, detectarTipoPix } from '@/lib/validarPix'

function validarNome(nome: string): { valido: boolean; erro?: string } {
  const partes = nome.trim().split(/\s+/).filter(p => p.length >= 2)
  if (nome.trim().length === 0) return { valido: false }
  if (partes.length < 2) return { valido: false, erro: 'Informe nome e sobrenome' }
  return { valido: true }
}

function JogosPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bolaoIdParam = searchParams.get('bolao')
  const { toast } = useToast()

  const [bolaoAtivo, setBolaoAtivo] = useState<Bolao | null>(null)
  const [loadingBolao, setLoadingBolao] = useState(true)
  const [mostrarTermos, setMostrarTermos] = useState(false)

  const [participante, setParticipante] = useState('')
  const [chavePix, setChavePix] = useState('')
  const [selecionados, setSelecionados] = useState<number[]>([])
  const [staging, setStaging] = useState<JogoStaging[]>([])
  const [nextSeq, setNextSeq] = useState('001')
  const [jogosSalvosParticipante, setJogosSalvosParticipante] = useState(0)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    async function loadBolao() {
      const supabase = createClient()

      let data: Bolao | null = null

      if (bolaoIdParam) {
        const res = await supabase
          .from('boloes')
          .select('*')
          .eq('id', bolaoIdParam)
          .single()
        data = res.data || null
      } else {
        const res = await supabase
          .from('boloes')
          .select('*')
          .eq('status', 'aberto')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        data = res.data || null
      }

      setBolaoAtivo(data)
      setLoadingBolao(false)

      if (data && !sessionStorage.getItem('termos_bolao_aceitos')) {
        setMostrarTermos(true)
      }
    }
    loadBolao()
  }, [bolaoIdParam])

  const calcNextSeq = useCallback(async (participanteNome: string, bolaoId: number) => {
    if (!participanteNome.trim()) return '001'
    const supabase = createClient()
    const { data } = await supabase
      .from('jogos')
      .select('sequencia')
      .eq('bolao_id', bolaoId)
      .ilike('participante', participanteNome.trim())

    const jogosSalvos = data?.length ?? 0
    setJogosSalvosParticipante(jogosSalvos)

    const inStaging = staging.filter(j =>
      j.participante.toLowerCase() === participanteNome.toLowerCase()
    )

    const allSeqs = [
      ...(data?.map(d => parseInt(d.sequencia, 10)) || []),
      ...inStaging.map(j => parseInt(j.sequencia, 10)),
    ].filter(n => !isNaN(n))

    const max = allSeqs.length > 0 ? Math.max(...allSeqs) : 0
    return pad3(max + 1)
  }, [staging])

  useEffect(() => {
    if (!participante.trim() || !bolaoAtivo) {
      setJogosSalvosParticipante(0)
      return
    }
    const timeout = setTimeout(async () => {
      const seq = await calcNextSeq(participante, bolaoAtivo.id)
      setNextSeq(seq)
    }, 400)
    return () => clearTimeout(timeout)
  }, [participante, bolaoAtivo, staging, calcNextSeq])

  function handleAceitarTermos() {
    sessionStorage.setItem('termos_bolao_aceitos', '1')
    setMostrarTermos(false)
  }

  function handleRecusarTermos() {
    router.push('/dashboard')
  }

  function gerarSurpresinha() {
    if (!bolaoAtivo) return
    const max = MODALIDADE_CONFIG[bolaoAtivo.modalidade as Modalidade].max
    const qtd = bolaoAtivo.qtd_numeros
    const pool = Array.from({ length: max }, (_, i) => i + 1)
    const result: number[] = []
    while (result.length < qtd) {
      const idx = Math.floor(Math.random() * pool.length)
      result.push(pool.splice(idx, 1)[0])
    }
    setSelecionados(result.sort((a, b) => a - b))
  }

  function completarJogo() {
    if (!bolaoAtivo) return
    const max = MODALIDADE_CONFIG[bolaoAtivo.modalidade as Modalidade].max
    const qtd = bolaoAtivo.qtd_numeros
    const faltam = qtd - selecionados.length
    if (faltam <= 0) return
    const pool = Array.from({ length: max }, (_, i) => i + 1)
      .filter(n => !selecionados.includes(n))
    const extras: number[] = []
    while (extras.length < faltam) {
      const idx = Math.floor(Math.random() * pool.length)
      extras.push(pool.splice(idx, 1)[0])
    }
    setSelecionados(prev => [...prev, ...extras].sort((a, b) => a - b))
  }

  function adicionarAoStaging() {
    if (!bolaoAtivo) return
    if (!participante.trim()) { toast('Informe o participante', 'error'); return }
    const nomeValidado = validarNome(participante)
    if (!nomeValidado.valido) { toast(nomeValidado.erro ?? 'Informe nome e sobrenome', 'error'); return }
    if (!chavePix.trim()) { toast('Informe a chave PIX do participante', 'error'); return }
    const pixValidado = validarChavePixAuto(chavePix)
    if (!pixValidado.valido) { toast(pixValidado.erro ?? 'Chave PIX inválida', 'error'); return }

    const qtdNumeros = bolaoAtivo.qtd_numeros
    const qtdJogosMax = bolaoAtivo.qtd_jogos
    const jogosNoStaging = staging.filter(j => j.participante.toLowerCase() === participante.trim().toLowerCase()).length
    const jogosTotal = jogosSalvosParticipante + jogosNoStaging

    if (jogosTotal >= qtdJogosMax) {
      toast(`${participante.trim().toUpperCase()} já atingiu o limite de ${qtdJogosMax} jogo${qtdJogosMax > 1 ? 's' : ''} neste bolão`, 'error')
      return
    }

    if (selecionados.length !== qtdNumeros) {
      toast(`Selecione exatamente ${qtdNumeros} números (${selecionados.length} selecionados)`, 'error')
      return
    }

    const jogo: JogoStaging = {
      tempId: uuidv4(),
      numeros: [...selecionados].sort((a, b) => a - b),
      quantidade: qtdNumeros,
      sequencia: nextSeq,
      participante: participante.trim().toUpperCase(),
      chavePix: pixValidado.formatado ?? chavePix.trim(),
    }

    setStaging(prev => [...prev, jogo])
    setSelecionados([])

    const nextN = parseInt(nextSeq, 10) + 1
    setNextSeq(pad3(nextN))
    toast('Jogo adicionado à lista!', 'success')
  }

  function removerDoStaging(tempId: string) {
    setStaging(prev => prev.filter(j => j.tempId !== tempId))
  }

  async function confirmarTodos() {
    if (staging.length === 0) { toast('Nenhum jogo para confirmar', 'error'); return }
    if (!bolaoAtivo) return
    setSalvando(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const registros = staging.map(j => ({
        bolao_id: bolaoAtivo.id,
        modalidade: bolaoAtivo.modalidade,
        user_id: user?.id || null,
        participante: j.participante,
        sequencia: j.sequencia,
        aposta: numerosToAposta(j.numeros),
        quantidade: j.quantidade,
        chave_pix: j.chavePix || null,
        codigo_autenticacao: uuidv4(),
        status_pagamento: 'pendente' as const,
        data: new Date().toISOString(),
      }))

      const { data: inserted, error } = await supabase
        .from('jogos')
        .insert(registros)
        .select('id')

      if (error) throw error

      toast(`${staging.length} jogo(s) registrado(s) com sucesso!`, 'success')
      setStaging([])
      setSelecionados([])
      setParticipante('')
      setChavePix('')
      setJogosSalvosParticipante(0)
      setNextSeq('001')

      if (inserted && inserted[0]) {
        router.push(`/comprovante/${inserted[0].id}`)
      }
    } catch (err: unknown) {
      toast((err as Error).message || 'Erro ao salvar jogos', 'error')
    } finally {
      setSalvando(false)
    }
  }

  if (loadingBolao) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Verificando bolão ativo...</p>
        </div>
      </div>
    )
  }

  if (!bolaoAtivo) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Nenhum bolão aberto</h2>
        <p className="text-gray-500 mt-2 mb-6">É necessário ter um bolão aberto para incluir jogos.</p>
        <Link href="/boloes/novo">
          <Button><Layers className="h-4 w-4" />Criar Bolão</Button>
        </Link>
      </div>
    )
  }

  const modalidade = bolaoAtivo.modalidade as Modalidade
  const qtdNumeros = bolaoAtivo.qtd_numeros ?? MODALIDADE_CONFIG[modalidade].minQtd
  const qtdJogosMax = bolaoAtivo.qtd_jogos ?? 99

  const clover = <FaClover className="text-3xl shrink-0" style={{ color: 'rgba(255,255,255,0.85)' }} />

  const MODALIDADE_META: Record<string, { cor: string; icone: ReactNode }> = {
    'Lotofácil':  { cor: '#91278F', icone: clover },
    'Mega-Sena':  { cor: '#00A651', icone: clover },
    'Quina':      { cor: '#2E3192', icone: clover },
    'Dupla Sena': { cor: '#A62B43', icone: clover },
  }
  const meta = MODALIDADE_META[modalidade] ?? { cor: '#6B7280', icone: clover }
  const cor = meta.cor

  return (
    <>
    {mostrarTermos && (
      <TermosModal onAceitar={handleAceitarTermos} onRecusar={handleRecusarTermos} />
    )}
    <div className="space-y-4 sm:space-y-6">
      {/* Banner da modalidade */}
      <div
        className="rounded-xl sm:rounded-2xl overflow-hidden"
        style={{ border: `1.5px solid ${cor}35` }}
      >
        <div className="px-4 sm:px-6 py-3 sm:py-4" style={{ background: cor }}>
          {/* Nome + concurso */}
          <div className="flex items-center justify-between gap-3 mb-2.5 sm:mb-4">
            <div>
              <p
                className="text-xs font-bold uppercase tracking-widest mb-1 sm:mb-2"
                style={{ color: 'rgba(255,255,255,0.6)' }}
              >
                Incluir Jogos
              </p>
              <div className="flex items-center gap-2">
                {meta.icone}
                <h1 className="text-white text-lg sm:text-2xl font-black tracking-tight leading-none">
                  {modalidade}
                </h1>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p
                className="text-xs font-bold uppercase tracking-widest mb-1"
                style={{ color: 'rgba(255,255,255,0.6)' }}
              >
                Concurso
              </p>
              <p className="text-white font-black leading-none text-2xl sm:text-4xl">
                #{bolaoAtivo.concurso}
              </p>
            </div>
          </div>
          {/* Sorteio + prêmio */}
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 sm:pt-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.55)' }}>Sorteio</p>
              <p className="text-white font-semibold text-xs sm:text-sm">
                {formatDate(bolaoAtivo.data_sorteio)}{bolaoAtivo.hora_sorteio ? ` · ${bolaoAtivo.hora_sorteio}` : ''}
              </p>
            </div>
            <div className="hidden sm:block h-6 w-px" style={{ background: 'rgba(255,255,255,0.2)' }} />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.55)' }}>Prêmio Estimado</p>
              <p className="text-white font-semibold text-xs sm:text-sm">{formatBRL(bolaoAtivo.valor_premio_inicial)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        {/* Formulário */}
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Ticket className="h-4 w-4 text-blue-700" />
                Novo Jogo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Participante *</Label>
                  <div className="relative">
                    <Input
                      placeholder="Nome e sobrenome"
                      value={participante}
                      onChange={e => setParticipante(e.target.value.toUpperCase())}
                      className={
                        participante.trim()
                          ? validarNome(participante).valido
                            ? 'border-green-500 pr-9'
                            : 'border-red-400 pr-9'
                          : ''
                      }
                    />
                    {participante.trim() && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        {validarNome(participante).valido
                          ? <CheckCircle className="h-4 w-4 text-green-600" />
                          : <XCircle className="h-4 w-4 text-red-500" />}
                      </span>
                    )}
                  </div>
                  {participante.trim() && !validarNome(participante).valido && (
                    <p className="text-xs text-red-500">{validarNome(participante).erro}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Sequência (automática)</Label>
                  <Input
                    value={nextSeq}
                    readOnly
                    className="bg-gray-50 text-gray-500 font-mono cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <QrCode className="h-3.5 w-3.5 text-gray-400" />
                  Chave PIX do participante *
                  {chavePix.trim() && (() => {
                    const tipo = detectarTipoPix(chavePix)
                    return tipo ? (
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{tipo}</span>
                    ) : null
                  })()}
                </Label>
                <div className="relative">
                  <Input
                    placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória (UUID)"
                    value={chavePix}
                    onChange={e => setChavePix(e.target.value)}
                    className={
                      chavePix.trim()
                        ? validarChavePixAuto(chavePix).valido
                          ? 'border-green-500 pr-9'
                          : 'border-red-400 pr-9'
                        : ''
                    }
                  />
                  {chavePix.trim() && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      {validarChavePixAuto(chavePix).valido
                        ? <CheckCircle className="h-4 w-4 text-green-600" />
                        : <XCircle className="h-4 w-4 text-red-500" />}
                    </span>
                  )}
                </div>
                {chavePix.trim() && !validarChavePixAuto(chavePix).valido && (
                  <p className="text-xs text-red-500">{validarChavePixAuto(chavePix).erro}</p>
                )}
              </div>

              {/* Regras fixas do bolão */}
              <div
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
                style={{ background: `${cor}10`, border: `1px solid ${cor}30` }}
              >
                <div className="flex-1" style={{ color: cor }}>
                  <span className="font-semibold">{qtdNumeros} números</span> por jogo
                  &nbsp;·&nbsp;
                  máx. <span className="font-semibold">{qtdJogosMax} jogo{qtdJogosMax > 1 ? 's' : ''}</span> por participante
                </div>
                {participante.trim() && (
                  <div className="shrink-0">
                    {(() => {
                      const jogosNoStaging = staging.filter(j => j.participante.toLowerCase() === participante.trim().toLowerCase()).length
                      const usados = jogosSalvosParticipante + jogosNoStaging
                      const restam = qtdJogosMax - usados
                      return (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${restam > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {restam > 0 ? `${restam} restante${restam > 1 ? 's' : ''}` : 'Limite atingido'}
                        </span>
                      )
                    })()}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Escolha os {qtdNumeros} números</Label>
                  <div className="flex items-center gap-1">
                    {selecionados.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelecionados([])}
                        className="text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Limpar
                      </Button>
                    )}
                    {selecionados.length > 0 && selecionados.length < qtdNumeros && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={completarJogo}
                        className="text-green-700"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Completar ({qtdNumeros - selecionados.length})
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={gerarSurpresinha}
                      className="text-blue-700"
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                      Surpresinha
                    </Button>
                  </div>
                </div>
                <NumberPicker
                  modalidade={modalidade}
                  quantidade={qtdNumeros}
                  selecionados={selecionados}
                  onChange={setSelecionados}
                />
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                style={{ borderColor: `${cor}55`, color: cor }}
                onClick={adicionarAoStaging}
                disabled={selecionados.length !== qtdNumeros}
              >
                <Plus className="h-4 w-4" />
                Adicionar à Lista
                {selecionados.length > 0 && selecionados.length < qtdNumeros && (
                  <span className="text-xs text-gray-400 ml-1">({selecionados.length}/{qtdNumeros})</span>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Staging Area */}
        <div className="space-y-4">
          <Card className={staging.length > 0 ? 'border-blue-200' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-blue-700" />
                  Lista de Jogos
                </CardTitle>
                {staging.length > 0 && (
                  <Badge variant="default">{staging.length}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {staging.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Adicione jogos à lista antes de confirmar</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {staging.map(jogo => (
                    <div
                      key={jogo.tempId}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="font-mono text-xs px-1.5 py-0.5 rounded"
                              style={{ background: `${cor}18`, color: cor }}
                            >
                              #{jogo.sequencia}
                            </span>
                            <span className="text-sm font-semibold text-gray-900 truncate">
                              {jogo.participante}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 font-mono leading-relaxed">
                            {jogo.numeros.map(n => pad2(n)).join(', ')}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {jogo.quantidade} números
                          </p>
                          {jogo.chavePix && (
                            <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                              <QrCode className="h-3 w-3" />
                              PIX: {jogo.chavePix}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => removerDoStaging(jogo.tempId)}
                          className="text-red-400 hover:text-red-600 transition-colors shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <Button
                    className="w-full"
                    variant="success"
                    size="lg"
                    onClick={confirmarTodos}
                    loading={salvando}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Confirmar {staging.length} Jogo{staging.length > 1 ? 's' : ''}
                  </Button>
                  <p className="text-xs text-center text-gray-400">
                    Após confirmar, você verá o comprovante e o QR Code PIX
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </>
  )
}

export default function JogosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Carregando...</p>
          </div>
        </div>
      }
    >
      <JogosPageContent />
    </Suspense>
  )
}

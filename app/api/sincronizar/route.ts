import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { bolao_id } = await request.json()
    if (!bolao_id) {
      return NextResponse.json({ error: 'bolao_id obrigatório' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: bolao, error: bolaoErr } = await supabase
      .from('boloes')
      .select('*')
      .eq('id', bolao_id)
      .single()

    if (bolaoErr || !bolao) {
      return NextResponse.json({ error: 'Bolão não encontrado' }, { status: 404 })
    }

    const { data: jogos, error: jogosErr } = await supabase
      .from('jogos')
      .select('*')
      .eq('bolao_id', bolao_id)

    if (jogosErr) {
      return NextResponse.json({ error: 'Erro ao buscar jogos' }, { status: 500 })
    }

    if (!jogos?.length) {
      return NextResponse.json({ sincronizados: 0, mensagem: 'Nenhum jogo encontrado para este bolão' })
    }

    const concurso = Number(bolao.concurso)
    const nomeGrupo = bolao.descricao || `${bolao.modalidade} ${bolao.concurso}`

    const registros = jogos.map((jogo) => ({
      modalidade: bolao.modalidade,
      nome_grupo: nomeGrupo,
      apostas: jogo.aposta,
      apostador: jogo.participante,
      status: 'A',
      especial: 'S',
      concurso_inicio: concurso,
      concurso_fim: concurso,
      concurso_ultimo: null,
      qtd_teimosinha: 1,
      valor_aposta: bolao.valor_cota,
      dias_sorteio: null,
    }))

    // Delete existing synced records for this bolão to avoid duplicates
    await supabase
      .from('jogos_mensal')
      .delete()
      .eq('modalidade', bolao.modalidade)
      .eq('nome_grupo', nomeGrupo)
      .eq('especial', 'S')
      .eq('concurso_inicio', concurso)

    const { error: insertErr } = await supabase
      .from('jogos_mensal')
      .insert(registros)

    if (insertErr) {
      return NextResponse.json({ error: `Erro ao sincronizar: ${insertErr.message}` }, { status: 500 })
    }

    return NextResponse.json({
      sincronizados: registros.length,
      mensagem: `${registros.length} jogo(s) sincronizado(s) para "${nomeGrupo}"`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

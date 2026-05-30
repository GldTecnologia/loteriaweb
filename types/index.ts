export type Modalidade = 'Lotofácil' | 'Mega-Sena' | 'Quina' | 'Dupla Sena'

export type StatusBolao = 'aberto' | 'encerrado' | 'sorteado'

export interface Bolao {
  id: number                  // bigint → number
  modalidade: Modalidade
  concurso: string
  data_sorteio: string
  valor_premio_inicial: number
  valor_cota: number
  qtd_jogos: number           // máx de jogos por participante
  qtd_numeros: number         // números por jogo (fixo)
  hora_sorteio?: string | null // horário do sorteio ex: "20:00"
  status: StatusBolao
  descricao?: string
  created_by?: string
  created_at: string
  updated_at?: string
}

export interface Jogo {
  id: number                  // bigint → number (tabela existente)
  bolao_id?: number | null
  user_id?: string
  participante: string
  sequencia: string
  aposta: string              // varchar: "01, 02, 03, ..." (formato original)
  quantidade: number
  modalidade: string
  chave_pix?: string
  codigo_autenticacao: string // uuid adicionado via ALTER TABLE
  status_pagamento: 'pendente' | 'pago'
  data: string                // campo original da tabela
  bolao?: Bolao
}

export interface ChavePix {
  id: number
  chave: string
  tipo: string | null   // text null no banco
  nome: string | null   // text null no banco
  cidade: string | null // text null no banco
  updated_at?: string
  created_at?: string
}

export interface TokenAcesso {
  id: number
  nome: string
  token: string
  dias_validade: number
  expira_em: string
  ativo: boolean
  created_at: string | null
}

export interface GrupoBolao {
  id: string
  grupo: string
  id_telegram: string
  participantes: string[] | null
  created_at: string | null
  user_id: string | null
}

export interface ApuracaoMensal {
  id: string
  data: string                // date
  modalidade: string
  nome_grupo: string
  valor_premio: number
  aposta_seq: number | null
  created_at: string | null
  user_id: string | null
}

export interface JogoStaging {
  tempId: string
  numeros: number[]
  quantidade: number
  sequencia: string
  participante: string
  chavePix?: string
}

export const MODALIDADE_CONFIG: Record<Modalidade, {
  max: number
  minQtd: number
  quantidades: number[]
  cor: string
  corBg: string
}> = {
  'Lotofácil': {
    max: 25,
    minQtd: 15,
    quantidades: [15, 16, 17, 18, 19, 20],
    cor: 'text-purple-700',
    corBg: 'bg-purple-50 border-purple-200',
  },
  'Mega-Sena': {
    max: 60,
    minQtd: 6,
    quantidades: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    cor: 'text-green-700',
    corBg: 'bg-green-50 border-green-200',
  },
  'Quina': {
    max: 80,
    minQtd: 5,
    quantidades: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    cor: 'text-blue-700',
    corBg: 'bg-blue-50 border-blue-200',
  },
  'Dupla Sena': {
    max: 50,
    minQtd: 6,
    quantidades: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    cor: 'text-red-700',
    corBg: 'bg-red-50 border-red-200',
  },
}

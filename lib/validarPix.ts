// lib/validarPix.ts — validação e formatação de chaves PIX

export type TipoPix = 'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA'

export interface ResultadoValidacao {
  valido: boolean
  erro?: string
  formatado?: string   // chave já normalizada para exibir ao usuário
}

// ─── CPF ─────────────────────────────────────────────────────────────────────

function validarCPF(raw: string): ResultadoValidacao {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 11) return { valido: false, erro: 'CPF deve ter 11 dígitos' }
  if (/^(\d)\1{10}$/.test(d)) return { valido: false, erro: 'CPF inválido' }

  const dig = (base: string, weights: number[]) => {
    const sum = base.split('').reduce((s, n, i) => s + parseInt(n) * weights[i], 0)
    const r = (sum * 10) % 11
    return r >= 10 ? 0 : r
  }

  const ok =
    dig(d.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]) === parseInt(d[9]) &&
    dig(d.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === parseInt(d[10])

  if (!ok) return { valido: false, erro: 'CPF inválido (dígitos verificadores incorretos)' }
  return { valido: true, formatado: d }
}

// ─── CNPJ ────────────────────────────────────────────────────────────────────

function validarCNPJ(raw: string): ResultadoValidacao {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 14) return { valido: false, erro: 'CNPJ deve ter 14 dígitos' }
  if (/^(\d)\1{13}$/.test(d)) return { valido: false, erro: 'CNPJ inválido' }

  const calc = (base: string, weights: number[]) => {
    const sum = base.split('').reduce((s, n, i) => s + parseInt(n) * weights[i], 0)
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }

  const ok =
    calc(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === parseInt(d[12]) &&
    calc(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === parseInt(d[13])

  if (!ok) return { valido: false, erro: 'CNPJ inválido (dígitos verificadores incorretos)' }
  return { valido: true, formatado: d }
}

// ─── E-mail ───────────────────────────────────────────────────────────────────

function validarEmail(raw: string): ResultadoValidacao {
  const trimmed = raw.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed))
    return { valido: false, erro: 'E-mail inválido' }
  return { valido: true, formatado: trimmed }
}

// ─── Telefone ─────────────────────────────────────────────────────────────────

function validarTelefone(raw: string): ResultadoValidacao {
  const d = raw.replace(/\D/g, '')

  // Com DDI 55: 12 (DDD + 8) ou 13 (DDD + 9) dígitos
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) {
    const ddd = parseInt(d.slice(2, 4))
    if (ddd < 11 || ddd > 99) return { valido: false, erro: 'DDD inválido' }
    return { valido: true, formatado: `+${d}` }
  }

  // Sem DDI: 10 (DDD + 8) ou 11 (DDD + 9) dígitos
  if (d.length === 10 || d.length === 11) {
    const ddd = parseInt(d.slice(0, 2))
    if (ddd < 11 || ddd > 99) return { valido: false, erro: 'DDD inválido (use DDD + número, ex: 11999999999)' }
    return { valido: true, formatado: `+55${d}` }
  }

  // Com + já prefixado
  if (raw.startsWith('+55')) {
    const digSemPlus = raw.slice(1).replace(/\D/g, '')
    if (digSemPlus.length === 12 || digSemPlus.length === 13)
      return { valido: true, formatado: `+${digSemPlus}` }
  }

  return {
    valido: false,
    erro: 'Telefone inválido. Use DDD + número (ex: 11999999999 ou 5511999999999)',
  }
}

// ─── Chave Aleatória (EVP / UUID) ─────────────────────────────────────────────

function validarEVP(raw: string): ResultadoValidacao {
  const trimmed = raw.trim().toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(trimmed))
    return { valido: false, erro: 'Chave aleatória inválida. Formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' }
  return { valido: true, formatado: trimmed }
}

// ─── Validador principal ──────────────────────────────────────────────────────

export function validarChavePix(tipo: TipoPix, chave: string): ResultadoValidacao {
  if (!chave.trim()) return { valido: false, erro: 'Informe a chave PIX' }

  switch (tipo) {
    case 'CPF':       return validarCPF(chave)
    case 'CNPJ':      return validarCNPJ(chave)
    case 'EMAIL':     return validarEmail(chave)
    case 'TELEFONE':  return validarTelefone(chave)
    case 'ALEATORIA': return validarEVP(chave)
    default:          return { valido: false, erro: 'Tipo de chave desconhecido' }
  }
}

/** Detecta automaticamente o tipo de chave pelo formato digitado */
export function detectarTipoPix(chave: string): TipoPix | null {
  const raw = chave.trim()
  if (!raw) return null

  if (raw.includes('@')) return 'EMAIL'
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return 'ALEATORIA'

  const digits = raw.replace(/\D/g, '')

  // Telefone com DDI 55: 12 ou 13 dígitos
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return 'TELEFONE'

  // Telefone sem DDI: 10 ou 11 dígitos com DDD válido + padrão de celular
  if ((digits.length === 10 || digits.length === 11) && /^[1-9][1-9]/.test(digits)) {
    const ddd = parseInt(digits.slice(0, 2))
    if (ddd >= 11 && ddd <= 99) {
      if (digits.length === 11 && digits[2] === '9') return 'TELEFONE'
      if (digits.length === 10) return 'TELEFONE'
    }
  }

  if (digits.length === 14) return 'CNPJ'
  if (digits.length === 11) return 'CPF'

  return null
}

/** Valida sem precisar informar o tipo (auto-detecta) */
export function validarChavePixAuto(chave: string): ResultadoValidacao {
  const tipo = detectarTipoPix(chave)
  if (!tipo) return { valido: false, erro: 'Formato não reconhecido. Use CPF, CNPJ, e-mail, telefone ou chave aleatória (UUID).' }
  return validarChavePix(tipo, chave)
}

// Placeholder e dica por tipo
export const DICA_PIX: Record<TipoPix, string> = {
  CPF:       '000.000.000-00 ou somente números',
  CNPJ:      '00.000.000/0000-00 ou somente números',
  EMAIL:     'exemplo@email.com',
  TELEFONE:  '11999999999 ou +5511999999999',
  ALEATORIA: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
}

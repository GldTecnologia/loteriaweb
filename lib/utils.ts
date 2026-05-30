import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function pad3(n: number): string {
  return String(n).padStart(3, '0')
}

export function numerosToString(numeros: number[]): string {
  return [...numeros].sort((a, b) => a - b).map(n => pad2(n)).join(', ')
}

/** Converte a string "01, 02, 03" da tabela jogos para array de numbers */
export function apostaToNumeros(aposta: string): number[] {
  return (aposta || '').split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
}

/** Converte array de numbers para o formato da tabela: "01, 02, 03" */
export function numerosToAposta(numeros: number[]): string {
  return [...numeros].sort((a, b) => a - b).map(n => pad2(n)).join(', ')
}

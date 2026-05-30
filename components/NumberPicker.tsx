'use client'

import { cn } from '@/lib/utils'
import type { Modalidade } from '@/types'
import { MODALIDADE_CONFIG } from '@/types'

interface NumberPickerProps {
  modalidade: Modalidade
  quantidade: number
  selecionados: number[]
  onChange: (nums: number[]) => void
}

export function NumberPicker({ modalidade, quantidade, selecionados, onChange }: NumberPickerProps) {
  const config = MODALIDADE_CONFIG[modalidade]
  if (!config) return null

  function toggle(n: number) {
    if (selecionados.includes(n)) {
      onChange(selecionados.filter(x => x !== n))
    } else {
      if (selecionados.length >= quantidade) return
      onChange([...selecionados, n])
    }
  }

  return (
    <div>
      <div className="grid gap-1 sm:gap-1.5 grid-cols-8 sm:grid-cols-10">
        {Array.from({ length: config.max }, (_, i) => i + 1).map(n => {
          const selected = selecionados.includes(n)
          return (
            <button
              key={n}
              type="button"
              onClick={() => toggle(n)}
              disabled={!selected && selecionados.length >= quantidade}
              className={cn(
                'aspect-square rounded-full text-xs font-bold transition-all duration-150 border',
                selected
                  ? 'bg-blue-700 text-white border-blue-700 scale-110 shadow-md'
                  : selecionados.length >= quantidade
                  ? 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700'
              )}
            >
              {String(n).padStart(2, '0')}
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between mt-3 text-sm">
        <span className="text-gray-500">
          Selecionados: <strong className="text-gray-900">{selecionados.length}</strong> / {quantidade}
        </span>
        {selecionados.length === quantidade && (
          <span className="text-green-600 font-semibold flex items-center gap-1">
            ✓ Completo
          </span>
        )}
      </div>
    </div>
  )
}

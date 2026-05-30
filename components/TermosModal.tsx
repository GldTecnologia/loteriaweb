'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ChevronDown } from 'lucide-react'

interface TermosModalProps {
  onAceitar: () => void
  onRecusar: () => void
}

const ITENS = [
  'O prêmio líquido eventualmente obtido será dividido proporcionalmente entre todas as cotas participantes do grupo, conforme as regras definidas pelo organizador;',
  'O sistema atua exclusivamente como ferramenta de gerenciamento das apostas e cotas;',
  'É responsabilidade dos participantes conferir seus dados, cotas e apostas registradas antes da confirmação;',
  'O comprovante oficial da aposta emitido pela Caixa é o único documento válido para fins de premiação;',
  'O comprovante de participação emitido por este sistema deve ser guardado pelo participante, pois servirá como evidência de sua participação no bolão e da quantidade de cotas adquiridas;',
  'Após a realização do pagamento, o participante deverá encaminhar o comprovante de pagamento ao organizador do bolão dentro do prazo estabelecido para validação e confirmação de sua participação;',
  'A participação no bolão somente será considerada efetivada após a confirmação do pagamento pelo organizador;',
  'A conferência dos resultados será realizada de forma automatizada com base nas informações disponibilizadas pelos serviços oficiais da Caixa Loterias e o resultado será compartilhado no grupo oficial de WhatsApp do bolão, permitindo que todos os participantes acompanhem a apuração;',
  'Em situações de indisponibilidade, instabilidade, atraso na divulgação dos resultados ou falhas técnicas nos serviços oficiais da Caixa Loterias, a conferência automática poderá sofrer atrasos ou não ser realizada temporariamente, sem prejuízo da validade das apostas registradas;',
  'Em caso de divergência, prevalecerão sempre as informações constantes no comprovante oficial da aposta emitido pela Caixa, nos registros do bolão e nos comprovantes de pagamento apresentados.',
]

export function TermosModal({ onAceitar, onRecusar }: TermosModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [leuTudo, setLeuTudo] = useState(false)

  function handleScroll() {
    const el = scrollRef.current
    if (!el || leuTudo) return
    // considera "chegou ao final" com tolerância de 12px
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) {
      setLeuTudo(true)
    }
  }

  function scrollParaBaixo() {
    scrollRef.current?.scrollBy({ top: 300, behavior: 'smooth' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] rounded-t-2xl">

        {/* Cabeçalho */}
        <div className="flex items-start gap-3 px-5 py-4 sm:px-6 sm:py-5 border-b border-gray-200 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-yellow-50 border border-yellow-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-gray-900">Aviso Importante</h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Role até o final para habilitar o aceite
            </p>
          </div>
          {/* Indicador de progresso */}
          {leuTudo ? (
            <span className="shrink-0 text-xs font-bold text-green-600 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
              ✓ Lido
            </span>
          ) : (
            <span className="shrink-0 text-xs font-bold text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-full px-2.5 py-1">
              Role ↓
            </span>
          )}
        </div>

        {/* Conteúdo rolável */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="overflow-y-auto flex-1 px-5 py-4 sm:px-6 sm:py-5 text-sm text-gray-700 space-y-4 leading-relaxed"
        >
          <p>
            Este bolão é organizado de forma independente e{' '}
            <strong>não possui vínculo, parceria, patrocínio ou administração com a Caixa Loterias</strong>{' '}
            ou qualquer outra entidade responsável pelas loterias oficiais.
          </p>
          <p>
            As apostas registradas neste sistema possuem caráter exclusivamente organizacional entre os
            participantes do grupo. A propriedade das apostas e o recebimento de eventuais prêmios estão
            vinculados ao comprovante oficial emitido pela lotérica ou pelos canais oficiais da Caixa.
          </p>
          <p className="font-semibold text-gray-900">
            Ao participar deste bolão, você declara estar ciente de que:
          </p>
          <ul className="space-y-2.5 pl-1">
            {ITENS.map((item, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-yellow-100 border border-yellow-300 text-yellow-700 text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="font-semibold text-gray-900 pt-1">
            Ao prosseguir, você confirma que leu, compreendeu e concorda com as regras de participação
            deste bolão.
          </p>
        </div>

        {/* Dica de rolar (some quando leu tudo) */}
        {!leuTudo && (
          <button
            onClick={scrollParaBaixo}
            className="flex items-center justify-center gap-1.5 py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors border-t border-gray-100 shrink-0"
          >
            <ChevronDown className="h-4 w-4 animate-bounce" />
            Role para continuar lendo
          </button>
        )}

        {/* Rodapé com botões */}
        <div className="px-5 py-4 sm:px-6 border-t border-gray-200 flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 sm:justify-end shrink-0">
          <Button variant="outline" onClick={onRecusar} className="w-full sm:w-auto">
            Recusar e Voltar
          </Button>
          <Button
            onClick={onAceitar}
            disabled={!leuTudo}
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ✅ Li e aceito os termos
          </Button>
        </div>
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/ui/toast'

export const metadata: Metadata = {
  title: 'Gestão de Apostas',
  description: 'Sistema de gestão de apostas de loteria',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="h-full bg-slate-50">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Ticket, ListChecks,
  MessageSquare, FileText, Settings, LogOut, Menu, X, Layers, CalendarDays
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import { isAdminEmail } from '@/lib/auth'

const NAV_BASE = [
  { href: '/dashboard',    label: 'Dashboard',       icon: LayoutDashboard, adminOnly: false },
  { href: '/boloes',        label: 'Bolões',           icon: Layers,          adminOnly: true  },
  { href: '/jogos-mensal', label: 'Ag. Conferência',  icon: CalendarDays,    adminOnly: true  },
  { href: '/jogos',        label: 'Incluir Jogos',    icon: Ticket,          adminOnly: false },
  { href: '/conferencia',  label: 'Conferência',      icon: ListChecks,      adminOnly: false },
  { href: '/relatorios',   label: 'Relatórios',       icon: FileText,        adminOnly: false },
  { href: '/whatsapp',     label: 'WhatsApp',         icon: MessageSquare,   adminOnly: true  },
  { href: '/configuracoes',label: 'Configurações',    icon: Settings,        adminOnly: true  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setIsAdmin(isAdminEmail(data.user?.email)))
  }, [])

  const navItems = NAV_BASE.filter(item => !item.adminOnly || isAdmin)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    sessionStorage.clear()
    router.push('/login')
  }

  const NavContent = () => (
    <>
      <div className="px-4 py-6 border-b border-blue-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center text-xl">
            🍀
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Gestão de Apostas</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'bg-white/15 text-white'
                  : 'text-blue-200 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-blue-700">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-blue-200 hover:bg-white/10 hover:text-white transition-all"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sair
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-blue-800 text-white shadow-lg"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'lg:hidden fixed top-0 left-0 z-50 h-full w-64 bg-blue-800 flex flex-col transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 text-blue-200 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        <NavContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-blue-800 fixed top-0 left-0 h-full shadow-xl">
        <NavContent />
      </aside>
    </>
  )
}

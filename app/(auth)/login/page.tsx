'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { QrCode, KeyRound, Mail, Lock, Eye, EyeOff } from 'lucide-react'

type Mode = 'login' | 'token'

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push('/dashboard')
    } catch (err: unknown) {
      toast((err as Error).message || 'Erro ao fazer login', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleTokenLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const supabase = createClient()
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('tokens_acesso')
        .select('*')
        .eq('token', token.trim())
        .eq('ativo', true)
        .gt('expira_em', now)
        .single()

      if (error || !data) throw new Error('Token inválido ou expirado')

      // Cookie acessível pelo proxy (server-side) para validar acesso por token
      const maxAge = Math.floor((new Date(data.expira_em).getTime() - Date.now()) / 1000)
      document.cookie = `token_acesso_ok=1; path=/; max-age=${maxAge}; SameSite=Lax`
      document.cookie = `token_nome=${encodeURIComponent(data.nome)}; path=/; max-age=${maxAge}; SameSite=Lax`
      router.push('/dashboard')
    } catch (err: unknown) {
      toast((err as Error).message || 'Token inválido', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500 shadow-xl mb-4 text-4xl">
            🍀
          </div>
          <h1 className="text-3xl font-bold text-white">Gestão de Apostas</h1>
          <p className="text-blue-300 mt-1">Sistema de gestão de apostas</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'login'
                  ? 'bg-white text-blue-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Mail className="h-4 w-4" />
              E-mail
            </button>
            <button
              onClick={() => setMode('token')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'token'
                  ? 'bg-white text-blue-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <KeyRound className="h-4 w-4" />
              Token
            </button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    className="pl-9"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pl-9 pr-9"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" loading={loading} size="lg">
                Entrar
              </Button>
            </form>
          ) : (
            <form onSubmit={handleTokenLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="token">Código de acesso</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="token"
                    type="text"
                    placeholder="Cole o token aqui"
                    className="pl-9 font-mono"
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    required
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Token temporário fornecido pelo administrador do bolão.
              </p>
              <Button type="submit" className="w-full" loading={loading} size="lg">
                Acessar com Token
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-blue-400 text-xs mt-6">
          🍀 Gestão de Apostas © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

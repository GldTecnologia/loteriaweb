'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TIMEOUT_MS = 3 * 60 * 1000 // 3 minutos
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const

export function InactivityGuard() {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function logout() {
      const supabase = createClient()
      await supabase.auth.signOut()
      sessionStorage.clear()
      router.push('/login')
    }

    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(logout, TIMEOUT_MS)
    }

    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      EVENTS.forEach(e => window.removeEventListener(e, reset))
    }
  }, [router])

  return null
}

import { Sidebar } from '@/components/Sidebar'
import { InactivityGuard } from '@/components/InactivityGuard'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-screen">
      <InactivityGuard />
      <Sidebar />
      <main className="flex-1 lg:ml-64 min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 pt-16 pb-6 sm:px-6 lg:px-8 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  )
}

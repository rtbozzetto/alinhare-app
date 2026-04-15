'use client'

import { useUserRole } from '@/hooks/use-user-role'
import { MobileNav } from '@/components/layout/sidebar'

export function Header() {
  const { role } = useUserRole()

  const roleLabel = role === 'admin' ? 'Administrador' : 'Profissional'

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-4 md:px-6">
      <MobileNav />
      <div className="hidden md:block w-10" />
      <span className="text-sm text-muted-foreground">{roleLabel}</span>
      <div className="w-10" />
    </header>
  )
}

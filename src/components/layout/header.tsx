'use client'

import { useUserRole } from '@/hooks/use-user-role'
import { NotificationBell } from '@/components/notifications/notification-bell'

export function Header() {
  const { role } = useUserRole()

  const roleLabel = role === 'admin' ? 'Administrador' : 'Profissional'

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-4 md:px-6">
      {/* Spacer for mobile hamburger */}
      <div className="w-10 md:hidden" />
      <span className="text-sm text-muted-foreground">{roleLabel}</span>
      <NotificationBell />
    </header>
  )
}

'use client'

import { useUserRole } from '@/hooks/use-user-role'
import { NotificationBell } from '@/components/notifications/notification-bell'

export function Header() {
  const { role } = useUserRole()

  const roleLabel = role === 'admin' ? 'Administrador' : 'Profissional'

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      <span className="text-sm text-muted-foreground">{roleLabel}</span>
      <NotificationBell />
    </header>
  )
}

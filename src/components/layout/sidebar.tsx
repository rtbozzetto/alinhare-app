'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useUserRole } from '@/hooks/use-user-role'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Users,
  Calendar,
  DollarSign,
  UserCog,
  MessageCircle,
  LogOut,
  Tag,
} from 'lucide-react'

const navItems = [
  { href: '/', label: 'Pacientes', icon: Users, adminOnly: false },
  { href: '/agenda', label: 'Agenda', icon: Calendar, adminOnly: false },
  { href: '/profissionais', label: 'Profissionais', icon: UserCog, adminOnly: true },
  { href: '/precos', label: 'Precos', icon: Tag, adminOnly: true },
  { href: '/faturamento', label: 'Faturamento', icon: DollarSign, adminOnly: true },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageCircle, adminOnly: true },
]

export function Sidebar() {
  const pathname = usePathname()
  const { signOut } = useAuth()
  const { isAdmin } = useUserRole()

  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin)

  return (
    <aside className="flex w-56 flex-col border-r bg-white">
      <div className="flex h-14 items-center px-4">
        <Link href="/" className="text-xl font-bold text-teal-600">
          Alinhare
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
        {visibleItems.map(item => {
          const Icon = item.icon
          const isActive =
            item.href === '/'
              ? pathname === '/' || pathname.startsWith('/pacientes')
              : pathname.startsWith(item.href)

          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start gap-2',
                  isActive && 'bg-teal-50 text-teal-700'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          )
        })}
      </nav>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  )
}

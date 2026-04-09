'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useUserRole } from '@/hooks/use-user-role'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Users,
  Calendar,
  DollarSign,
  UserCog,
  MessageCircle,
  LogOut,
  Tag,
  Menu,
} from 'lucide-react'

const navItems = [
  { href: '/', label: 'Pacientes', icon: Users, adminOnly: false },
  { href: '/agenda', label: 'Agenda', icon: Calendar, adminOnly: false },
  { href: '/profissionais', label: 'Profissionais', icon: UserCog, adminOnly: true },
  { href: '/precos', label: 'Preços', icon: Tag, adminOnly: true },
  { href: '/faturamento', label: 'Faturamento', icon: DollarSign, adminOnly: true },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageCircle, adminOnly: true },
]

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { signOut } = useAuth()
  const { isAdmin } = useUserRole()

  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin)

  return (
    <>
      <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
        {visibleItems.map(item => {
          const Icon = item.icon
          const isActive =
            item.href === '/'
              ? pathname === '/' || pathname.startsWith('/pacientes')
              : pathname.startsWith(item.href)

          return (
            <Link key={item.href} href={item.href} onClick={onNavigate}>
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start gap-2 h-11',
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
          className="w-full justify-start gap-2 h-11 text-muted-foreground"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </>
  )
}

export function Sidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r bg-white">
        <div className="flex h-14 items-center px-4">
          <Link href="/" className="text-xl font-bold text-teal-600">
            Alinhare
          </Link>
        </div>
        <NavContent />
      </aside>

      {/* Mobile hamburger button — rendered in header area via CSS positioning */}
      <div className="fixed top-0 left-0 z-50 flex h-14 items-center px-3 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="flex h-14 items-center px-4 border-b">
              <SheetTitle className="text-xl font-bold text-teal-600">
                Alinhare
              </SheetTitle>
            </SheetHeader>
            <div className="flex flex-1 flex-col h-[calc(100vh-3.5rem)]">
              <NavContent onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}

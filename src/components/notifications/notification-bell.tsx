'use client'

import { Bell, Trash2 } from 'lucide-react'
import { useNotifications } from '@/hooks/use-notifications'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin} min atras`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h atras`
  const diffD = Math.floor(diffH / 24)
  return `${diffD}d atras`
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteRead } =
    useNotifications()

  const readCount = notifications.filter(n => n.read).length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-medium">Notificacoes</span>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => markAllAsRead()}
                className="text-xs text-teal-600"
              >
                Marcar lidas
              </Button>
            )}
            {readCount > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => deleteRead()}
                className="text-xs text-red-500"
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Excluir lidas
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Nenhuma notificacao.
            </p>
          ) : (
            notifications.map(n => (
              <button
                key={n.id}
                className={cn(
                  'flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left transition-colors hover:bg-accent',
                  !n.read && 'bg-teal-50/50'
                )}
                onClick={() => !n.read && markAsRead(n.id)}
              >
                <span className="text-sm font-medium">{n.title}</span>
                <span className="text-xs text-muted-foreground">
                  {n.message}
                </span>
                <span className="text-xs text-muted-foreground">
                  {timeAgo(n.created_at)}
                </span>
              </button>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

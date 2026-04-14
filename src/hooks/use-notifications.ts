'use client'
import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Notification } from '@/types/database'
import { useUserRole } from '@/hooks/use-user-role'

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const { isAdmin, professionalId } = useUserRole()

  const fetchNotifications = useCallback(async () => {
    setLoading(true)

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) {
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.read).length)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  const markAsRead = async (id: string) => {
    const notification = notifications.find(n => n.id === id)
    if (notification?.read) return // Already read, skip
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const deleteRead = async () => {
    const readIds = notifications.filter(n => n.read).map(n => n.id)
    if (readIds.length === 0) return
    await supabase.from('notifications').delete().in('id', readIds)
    setNotifications(prev => prev.filter(n => !n.read))
  }

  return { notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead, deleteRead }
}

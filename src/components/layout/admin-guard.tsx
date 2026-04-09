'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUserRole } from '@/hooks/use-user-role'

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useUserRole()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace('/')
    }
  }, [loading, isAdmin, router])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    )
  }

  if (!isAdmin) return null

  return <>{children}</>
}

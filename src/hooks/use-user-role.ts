'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type AppRole } from '@/types/database'

export function useUserRole() {
  const [role, setRole] = useState<AppRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [professionalId, setProfessionalId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function fetchRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: user.id })
      setRole((roleData as AppRole) || null)

      if (roleData === 'profissional') {
        const { data: prof } = await supabase
          .from('professionals')
          .select('id')
          .eq('auth_user_id', user.id)
          .single()
        setProfessionalId(prof?.id || null)
      }
      setLoading(false)
    }
    fetchRole()
  }, [supabase])

  return {
    role,
    isAdmin: role === 'admin',
    isProfessional: role === 'profissional',
    professionalId,
    loading,
  }
}

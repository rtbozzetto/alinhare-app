'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useProfessionals } from '@/hooks/use-professionals'
import { AdminGuard } from '@/components/layout/admin-guard'
import { ProfessionalForm } from '@/components/professionals/professional-form'
import { type Professional } from '@/types/database'

export default function ProfessionalDetailPage() {
  return (
    <AdminGuard>
      <ProfessionalDetailContent />
    </AdminGuard>
  )
}

function ProfessionalDetailContent() {
  const params = useParams()
  const profId = params.id as string
  const { getProfessional } = useProfessionals()
  const [professional, setProfessional] = useState<Professional | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await getProfessional(profId)
      setProfessional(data)
      setLoading(false)
    }
    load()
  }, [profId, getProfessional])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    )
  }

  if (!professional) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Profissional nao encontrado.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{professional.full_name}</h1>
      <ProfessionalForm professional={professional} />
    </div>
  )
}

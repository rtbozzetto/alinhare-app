'use client'

import { AdminGuard } from '@/components/layout/admin-guard'
import { ProfessionalForm } from '@/components/professionals/professional-form'

export default function NewProfessionalPage() {
  return (
    <AdminGuard>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Novo Profissional</h1>
        <ProfessionalForm />
      </div>
    </AdminGuard>
  )
}

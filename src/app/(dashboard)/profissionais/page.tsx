'use client'

import Link from 'next/link'
import { useProfessionals } from '@/hooks/use-professionals'
import { AdminGuard } from '@/components/layout/admin-guard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Phone } from 'lucide-react'

export default function ProfessionalsPage() {
  return (
    <AdminGuard>
      <ProfessionalsList />
    </AdminGuard>
  )
}

function ProfessionalsList() {
  const { professionals, loading } = useProfessionals()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Profissionais</h1>
        <Link href="/profissionais/novo">
          <Button className="bg-teal-600 hover:bg-teal-700">
            <Plus className="mr-2 h-4 w-4" />
            Novo Profissional
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      ) : professionals.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          Nenhum profissional cadastrado.
        </div>
      ) : (
        <div className="grid gap-3">
          {professionals.map(prof => (
            <Link key={prof.id} href={`/profissionais/${prof.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{prof.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {prof.specialty || 'Sem especialidade'}
                      {prof.email && ` - ${prof.email}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {prof.phone && (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {prof.phone}
                      </span>
                    )}
                    <Badge variant={prof.active ? 'default' : 'secondary'}>
                      {prof.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

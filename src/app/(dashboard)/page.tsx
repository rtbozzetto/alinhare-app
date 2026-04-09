'use client'
import { useState } from 'react'
import { usePatients } from '@/hooks/use-patients'
import { useUserRole } from '@/hooks/use-user-role'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Search, Plus, Phone } from 'lucide-react'
import Link from 'next/link'
import { calculateAge, formatPhone } from '@/lib/utils'

export default function HomePage() {
  const { patients, loading } = usePatients()
  const { isAdmin } = useUserRole()
  const [search, setSearch] = useState('')

  const filtered = patients.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.phone?.includes(search) ||
    p.cpf?.includes(search)
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pacientes</h1>
        <Link href="/pacientes/novo">
          <Button className="bg-teal-600 hover:bg-teal-700">
            <Plus className="mr-2 h-4 w-4" />
            Novo Paciente
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, telefone ou CPF..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          {search ? 'Nenhum paciente encontrado.' : 'Nenhum paciente cadastrado.'}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(patient => (
            <Link key={patient.id} href={`/pacientes/${patient.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{patient.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {calculateAge(patient.birth_date)} anos
                      {patient.main_complaint && ` • ${patient.main_complaint}`}
                    </p>
                  </div>
                  {patient.phone && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {patient.phone}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

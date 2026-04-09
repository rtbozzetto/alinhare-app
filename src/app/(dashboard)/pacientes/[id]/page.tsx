'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { usePatients } from '@/hooks/use-patients'
import { useUserRole } from '@/hooks/use-user-role'
import { type Patient } from '@/types/database'
import { PatientForm } from '@/components/patients/patient-form'
import { TreatmentPlansTab } from '@/components/patients/treatment-plans-tab'
import { SessionsTab } from '@/components/patients/sessions-tab'
import { PhotosTab } from '@/components/patients/photos-tab'
import { ExamsTab } from '@/components/patients/exams-tab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function PatientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const patientId = params.id as string
  const defaultTab = searchParams.get('tab') || 'dados'
  const { getPatient, deletePatient } = usePatients()
  const { isAdmin } = useUserRole()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await getPatient(patientId)
      setPatient(data)
      setLoading(false)
    }
    load()
  }, [patientId, getPatient])

  async function handleDelete() {
    setDeleting(true)
    const { error } = await deletePatient(patientId)
    setDeleting(false)
    if (error) {
      toast.error('Erro ao excluir paciente.')
    } else {
      toast.success('Paciente excluido com sucesso.')
      router.push('/')
    }
    setDeleteOpen(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Paciente nao encontrado.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold truncate">{patient.full_name}</h1>
        {isAdmin && (
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Excluir paciente</DialogTitle>
                <DialogDescription>
                  Tem certeza que deseja excluir {patient.full_name}? Esta acao
                  nao pode ser desfeita.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Excluindo...' : 'Excluir'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="dados" className="text-xs sm:text-sm">Dados</TabsTrigger>
          <TabsTrigger value="planos" className="text-xs sm:text-sm">Planos</TabsTrigger>
          <TabsTrigger value="sessoes" className="text-xs sm:text-sm">Sessoes</TabsTrigger>
          <TabsTrigger value="fotos" className="text-xs sm:text-sm">Fotos</TabsTrigger>
          <TabsTrigger value="exames" className="text-xs sm:text-sm">Exames</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <PatientForm patient={patient} />
        </TabsContent>

        <TabsContent value="planos">
          <TreatmentPlansTab patientId={patientId} />
        </TabsContent>

        <TabsContent value="sessoes">
          <SessionsTab patientId={patientId} />
        </TabsContent>

        <TabsContent value="fotos">
          <PhotosTab patientId={patientId} />
        </TabsContent>

        <TabsContent value="exames">
          <ExamsTab patientId={patientId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

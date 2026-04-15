'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useProfessionals } from '@/hooks/use-professionals'
import { AdminGuard } from '@/components/layout/admin-guard'
import { ProfessionalForm } from '@/components/professionals/professional-form'
import { type Professional } from '@/types/database'
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

export default function ProfessionalDetailPage() {
  return (
    <AdminGuard>
      <ProfessionalDetailContent />
    </AdminGuard>
  )
}

function ProfessionalDetailContent() {
  const params = useParams()
  const router = useRouter()
  const profId = params.id as string
  const { getProfessional, deleteProfessional } = useProfessionals()
  const [professional, setProfessional] = useState<Professional | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await getProfessional(profId)
      setProfessional(data)
      setLoading(false)
    }
    load()
  }, [profId, getProfessional])

  async function handleDelete() {
    if (!professional) return
    setDeleting(true)

    // If professional has auth user, delete access first
    if (professional.auth_user_id) {
      try {
        await fetch('/api/professionals/manage-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ professional_id: professional.id, action: 'delete' }),
        })
      } catch {}
    }

    const { error } = await deleteProfessional(professional.id)
    setDeleting(false)
    if (error) {
      toast.error('Erro ao excluir profissional. Pode ter agendamentos vinculados.')
    } else {
      toast.success('Profissional excluído com sucesso.')
      router.push('/profissionais')
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

  if (!professional) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Profissional nao encontrado.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold truncate">{professional.full_name}</h1>
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir profissional</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir {professional.full_name}?
                {professional.auth_user_id && ' O acesso ao sistema também será removido.'}
                {' '}Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
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
      </div>
      <ProfessionalForm professional={professional} />
    </div>
  )
}

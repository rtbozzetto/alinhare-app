'use client'

import { useEffect, useState } from 'react'
import { useReceipts } from '@/hooks/use-receipts'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ReceiptFormDialog } from '@/components/receipts/receipt-form-dialog'
import { formatCurrency } from '@/lib/utils'
import { Plus, FileText, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

interface ReceiptsTabProps {
  patientId: string
  patientName?: string
}

export function ReceiptsTab({ patientId, patientName }: ReceiptsTabProps) {
  const { receipts, loading, fetchByPatient, deleteReceipt } = useReceipts()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [patientCpf, setPatientCpf] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    fetchByPatient(patientId)
    // Fetch patient CPF and phone for pre-filling
    ;(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('patients')
        .select('cpf, phone')
        .eq('id', patientId)
        .single()
      if (data) {
        setPatientCpf(data.cpf ?? '')
        setPatientPhone(data.phone ?? '')
      }
    })()
  }, [patientId, fetchByPatient])

  async function handleDelete(id: string) {
    const { error } = await deleteReceipt(id)
    if (error) toast.error('Erro ao excluir recibo.')
    else toast.success('Recibo excluído.')
    setConfirmDelete(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recibos</h2>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Recibo
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      ) : receipts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhum recibo emitido para este paciente.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {receipts.map(r => (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-teal-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{formatCurrency(r.amount)}</span>
                      <Badge variant="outline" className="text-[10px]">{r.payment_method}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {new Date(r.issued_at + 'T12:00:00').toLocaleDateString('pt-BR')} — {r.description}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-700"
                  onClick={() => setConfirmDelete(r.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ReceiptFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        patientId={patientId}
        patientName={patientName}
        patientCpf={patientCpf}
        patientPhone={patientPhone}
        onSaved={() => fetchByPatient(patientId)}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={v => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir recibo</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apaga o registro do histórico. O PDF já baixado não é afetado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

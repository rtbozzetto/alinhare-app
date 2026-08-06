'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useReceipts } from '@/hooks/use-receipts'
import { AdminGuard } from '@/components/layout/admin-guard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ReceiptFormDialog } from '@/components/receipts/receipt-form-dialog'
import { formatCurrency } from '@/lib/utils'
import { Plus, FileText, Search, Trash2 } from 'lucide-react'
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

export default function RecibosPage() {
  return (
    <AdminGuard>
      <RecibosContent />
    </AdminGuard>
  )
}

function RecibosContent() {
  const { receipts, loading, fetchAll, deleteReceipt } = useReceipts()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => { fetchAll() }, [fetchAll])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return receipts
    return receipts.filter(r =>
      r.payer_name.toLowerCase().includes(q) ||
      r.payer_cpf.includes(q) ||
      r.description.toLowerCase().includes(q)
    )
  }, [receipts, search])

  async function handleDelete(id: string) {
    const { error } = await deleteReceipt(id)
    if (error) toast.error('Erro ao excluir.')
    else toast.success('Recibo excluído.')
    setConfirmDelete(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold">Recibos</h1>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Recibo Avulso
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome, CPF ou descrição..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {receipts.length === 0 ? 'Nenhum recibo emitido ainda.' : 'Nenhum resultado.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <FileText className="h-5 w-5 text-teal-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {r.patient_id ? (
                          <Link href={`/pacientes/${r.patient_id}?tab=recibos`} className="hover:underline">
                            {r.payer_name}
                          </Link>
                        ) : (
                          r.payer_name
                        )}
                      </span>
                      <span className="font-semibold text-teal-600">{formatCurrency(r.amount)}</span>
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
        onSaved={() => fetchAll()}
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

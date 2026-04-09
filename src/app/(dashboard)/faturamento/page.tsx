'use client'

import { useEffect, useState, useMemo } from 'react'
import { format, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useBilling } from '@/hooks/use-billing'
import { useProfessionals } from '@/hooks/use-professionals'
import { AdminGuard } from '@/components/layout/admin-guard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, FileDown, Lock, Unlock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { APPOINTMENT_TYPES, PAYMENT_STATUSES } from '@/lib/constants'
import { generateBillingPdf } from '@/lib/pdf'
import { toast } from 'sonner'

export default function FaturamentoPage() {
  return (
    <AdminGuard>
      <BillingContent />
    </AdminGuard>
  )
}

function BillingContent() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [filterProfId, setFilterProfId] = useState<string>('all')

  const { appointments, closings, fetchAppointmentsByMonth, fetchClosings, closeMonth, reopenMonth, loading } =
    useBilling()
  const { activeProfessionals } = useProfessionals()

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth() + 1
  const refMonth = `${year}-${String(month).padStart(2, '0')}`

  const currentClosing = closings.find(c => c.reference_month === refMonth)
  const isClosed = currentClosing?.status === 'fechado'

  useEffect(() => {
    fetchAppointmentsByMonth(year, month)
    fetchClosings()
  }, [year, month, fetchAppointmentsByMonth, fetchClosings])

  const filteredAppointments = useMemo(() => {
    if (filterProfId === 'all') return appointments
    return appointments.filter(a => a.professional_id === filterProfId)
  }, [appointments, filterProfId])

  const totals = useMemo(() => {
    const bruto = filteredAppointments.reduce((sum, a) => sum + (a.custom_price ?? 0), 0)
    const desconto = filteredAppointments.reduce((sum, a) => sum + a.discount_amount, 0)
    const liquido = filteredAppointments.reduce((sum, a) => sum + a.final_paid_amount, 0)
    const repasse = filteredAppointments.reduce((sum, a) => sum + a.commission_amount, 0)
    const clinica = filteredAppointments.reduce((sum, a) => sum + a.clinic_amount, 0)
    return { bruto, desconto, liquido, repasse, clinica }
  }, [filteredAppointments])

  async function handleCloseMonth() {
    const { error } = await closeMonth(refMonth, {
      total_bruto: totals.bruto,
      total_desconto: totals.desconto,
      total_liquido: totals.liquido,
      total_repasse: totals.repasse,
      total_clinica: totals.clinica,
      total_appointments: filteredAppointments.length,
      snapshot: filteredAppointments,
    })
    if (error) {
      toast.error('Erro ao fechar mes.')
    } else {
      toast.success('Mes fechado com sucesso!')
    }
  }

  async function handleReopenMonth() {
    const { error } = await reopenMonth(refMonth)
    if (error) {
      toast.error('Erro ao reabrir mes.')
    } else {
      toast.success('Mes reaberto com sucesso!')
    }
  }

  function handleExportPdf() {
    const profName = filterProfId === 'all'
      ? 'Todos'
      : activeProfessionals.find(p => p.id === filterProfId)?.full_name ?? 'Profissional'
    generateBillingPdf(filteredAppointments, profName, refMonth, totals)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold">Faturamento</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterProfId} onValueChange={(value: string) => setFilterProfId(value)}>
            <SelectTrigger className="w-36 sm:w-48">
              <SelectValue placeholder="Profissional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {activeProfessionals.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[100px] sm:min-w-[140px] text-center text-sm font-medium capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Bruto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm sm:text-lg font-bold">{formatCurrency(totals.bruto)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Desconto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm sm:text-lg font-bold text-red-600">{formatCurrency(totals.desconto)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Liquido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm sm:text-lg font-bold text-teal-600">{formatCurrency(totals.liquido)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Repasse</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm sm:text-lg font-bold">{formatCurrency(totals.repasse)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Clinica</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm sm:text-lg font-bold">{formatCurrency(totals.clinica)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {isClosed ? (
          <Button variant="outline" onClick={handleReopenMonth}>
            <Unlock className="mr-2 h-4 w-4" />
            Reabrir Mes
          </Button>
        ) : (
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleCloseMonth}>
            <Lock className="mr-2 h-4 w-4" />
            Fechar Mes
          </Button>
        )}
        <Button variant="outline" onClick={handleExportPdf}>
          <FileDown className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
        {isClosed && (
          <Badge variant="secondary">Mes Fechado</Badge>
        )}
      </div>

      {/* Appointments table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          Nenhum agendamento neste periodo.
        </div>
      ) : (
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Data</TableHead>
              <TableHead className="whitespace-nowrap">Paciente</TableHead>
              <TableHead className="whitespace-nowrap">Profissional</TableHead>
              <TableHead className="whitespace-nowrap">Tipo</TableHead>
              <TableHead className="whitespace-nowrap">Valor</TableHead>
              <TableHead className="whitespace-nowrap">Desconto</TableHead>
              <TableHead className="whitespace-nowrap">Liquido</TableHead>
              <TableHead className="whitespace-nowrap">Comissao</TableHead>
              <TableHead className="whitespace-nowrap">Clinica</TableHead>
              <TableHead className="whitespace-nowrap">Pagamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAppointments.map(appt => (
              <TableRow key={appt.id}>
                <TableCell className="whitespace-nowrap">
                  {new Date(appt.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell className="whitespace-nowrap">{appt.patient?.full_name ?? '-'}</TableCell>
                <TableCell className="whitespace-nowrap">{appt.professional?.full_name ?? '-'}</TableCell>
                <TableCell>
                  {APPOINTMENT_TYPES.find(t => t.value === appt.appointment_type)?.label ?? appt.appointment_type}
                </TableCell>
                <TableCell>{formatCurrency(appt.custom_price ?? 0)}</TableCell>
                <TableCell>{formatCurrency(appt.discount_amount)}</TableCell>
                <TableCell>{formatCurrency(appt.final_paid_amount)}</TableCell>
                <TableCell>{formatCurrency(appt.commission_amount)}</TableCell>
                <TableCell>{formatCurrency(appt.clinic_amount)}</TableCell>
                <TableCell>
                  <Badge variant={appt.payment_status === 'pago' ? 'default' : 'secondary'}>
                    {PAYMENT_STATUSES.find(s => s.value === appt.payment_status)?.label ?? appt.payment_status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}
    </div>
  )
}

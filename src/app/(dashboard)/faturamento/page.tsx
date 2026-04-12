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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ChevronLeft, ChevronRight, FileDown, Lock, Unlock, Trash2 } from 'lucide-react'
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

  const { appointments, paidPlans, completedSessions, closings, fetchAppointmentsByMonth, fetchClosings, closeMonth, reopenMonth, deleteAppointment, loading } =
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

  const filteredPlans = useMemo(() => {
    if (filterProfId === 'all') return paidPlans
    return paidPlans.filter(p => p.professional_id === filterProfId)
  }, [paidPlans, filterProfId])

  const filteredSessions = useMemo(() => {
    if (filterProfId === 'all') return completedSessions
    return completedSessions.filter(s => s.professional_id === filterProfId)
  }, [completedSessions, filterProfId])

  const totals = useMemo(() => {
    const apptBruto = filteredAppointments.reduce((sum, a) => sum + (a.custom_price ?? 0), 0)
    const apptDesconto = filteredAppointments.reduce((sum, a) => sum + a.discount_amount, 0)
    const apptLiquido = filteredAppointments.reduce((sum, a) => sum + a.final_paid_amount, 0)
    const apptRepasse = filteredAppointments.reduce((sum, a) => sum + a.commission_amount, 0)
    const apptClinica = filteredAppointments.reduce((sum, a) => sum + a.clinic_amount, 0)

    const planBruto = filteredPlans.reduce((sum, p) => sum + p.price, 0)
    const planDesconto = filteredPlans.reduce((sum, p) => sum + p.discount_amount, 0)
    const planLiquido = filteredPlans.reduce((sum, p) => sum + p.final_paid_amount, 0)
    const planRepasse = filteredPlans.reduce((sum, p) => sum + p.commission_amount, 0)
    const planClinica = filteredPlans.reduce((sum, p) => sum + p.clinic_amount, 0)

    const sessBruto = filteredSessions.reduce((sum, s) => sum + s.price, 0)
    const sessDesconto = filteredSessions.reduce((sum, s) => sum + s.discount_amount, 0)
    const sessLiquido = filteredSessions.reduce((sum, s) => sum + s.final_paid_amount, 0)
    const sessRepasse = filteredSessions.reduce((sum, s) => sum + s.commission_amount, 0)
    const sessClinica = filteredSessions.reduce((sum, s) => sum + s.clinic_amount, 0)

    return {
      bruto: apptBruto + planBruto + sessBruto,
      desconto: apptDesconto + planDesconto + sessDesconto,
      liquido: apptLiquido + planLiquido + sessLiquido,
      repasse: apptRepasse + planRepasse + sessRepasse,
      clinica: apptClinica + planClinica + sessClinica,
    }
  }, [filteredAppointments, filteredPlans, filteredSessions])

  async function handleCloseMonth() {
    const totalRecords = filteredAppointments.length + filteredPlans.length + filteredSessions.length
    if (totalRecords === 0) {
      toast.error('Não há registros para fechar neste período.')
      return
    }
    const snapshot = [
      ...filteredPlans.map(p => ({ ...p, _source: 'plan' })),
      ...filteredSessions.map(s => ({ ...s, _source: 'session' })),
      ...filteredAppointments,
    ]
    const { error } = await closeMonth(refMonth, {
      total_bruto: totals.bruto,
      total_desconto: totals.desconto,
      total_liquido: totals.liquido,
      total_repasse: totals.repasse,
      total_clinica: totals.clinica,
      total_appointments: totalRecords,
      snapshot,
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
    generateBillingPdf(filteredAppointments, filteredPlans, filteredSessions, profName, refMonth, totals)
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

      {/* Billing table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      ) : filteredAppointments.length === 0 && filteredPlans.length === 0 && filteredSessions.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          Nenhum registro neste periodo.
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
              <TableHead className="whitespace-nowrap">Sessão</TableHead>
              <TableHead className="whitespace-nowrap">Valor</TableHead>
              <TableHead className="whitespace-nowrap">Desconto</TableHead>
              <TableHead className="whitespace-nowrap">Liquido</TableHead>
              <TableHead className="whitespace-nowrap">Comissao</TableHead>
              <TableHead className="whitespace-nowrap">Clinica</TableHead>
              <TableHead className="whitespace-nowrap">Pagamento</TableHead>
              {!isClosed && <TableHead className="w-10"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Paid treatment plans */}
            {filteredPlans.map(plan => (
              <TableRow key={`plan-${plan.id}`} className="bg-teal-50/30">
                <TableCell className="whitespace-nowrap">
                  {new Date(plan.created_at).toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell className="whitespace-nowrap">{plan.patient_name}</TableCell>
                <TableCell className="whitespace-nowrap">{plan.professional_name}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px] px-1 py-0">Plano</Badge>
                    {plan.plan_name}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{plan.plan_type === 'avaliacao' ? '—' : `${plan.plan_type === 'treatment' ? 'Tratamento' : 'Manutenção'}`}</TableCell>
                <TableCell>{formatCurrency(plan.price)}</TableCell>
                <TableCell>{formatCurrency(plan.discount_amount)}</TableCell>
                <TableCell>{formatCurrency(plan.final_paid_amount)}</TableCell>
                <TableCell>{formatCurrency(plan.commission_amount)}</TableCell>
                <TableCell>{formatCurrency(plan.clinic_amount)}</TableCell>
                <TableCell>
                  <Badge variant="default">
                    {PAYMENT_STATUSES.find(s => s.value === plan.payment_status)?.label ?? plan.payment_status}
                  </Badge>
                </TableCell>
                {!isClosed && <TableCell />}
              </TableRow>
            ))}
            {/* Completed sessions without appointments */}
            {filteredSessions.map(sess => (
              <TableRow key={`sess-${sess.id}`} className="bg-amber-50/30">
                <TableCell className="whitespace-nowrap">
                  {new Date(sess.session_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell className="whitespace-nowrap">{sess.patient_name}</TableCell>
                <TableCell className="whitespace-nowrap">{sess.professional_name}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px] px-1 py-0">Sessão</Badge>
                    {sess.plan_name}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {sess.session_number} de {sess.total_sessions}
                </TableCell>
                <TableCell>{formatCurrency(sess.price)}</TableCell>
                <TableCell>{formatCurrency(sess.discount_amount)}</TableCell>
                <TableCell>{formatCurrency(sess.final_paid_amount)}</TableCell>
                <TableCell>{formatCurrency(sess.commission_amount)}</TableCell>
                <TableCell>{formatCurrency(sess.clinic_amount)}</TableCell>
                <TableCell>
                  <Badge variant={sess.payment_status === 'pago' || sess.payment_status === 'pago_pacote' ? 'default' : 'secondary'}>
                    {PAYMENT_STATUSES.find(s => s.value === sess.payment_status)?.label ?? sess.payment_status}
                  </Badge>
                </TableCell>
                {!isClosed && <TableCell />}
              </TableRow>
            ))}
            {/* Appointments */}
            {filteredAppointments.map(appt => (
              <TableRow key={appt.id}>
                <TableCell className="whitespace-nowrap">
                  {new Date(appt.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell className="whitespace-nowrap">{appt.patient?.full_name ?? '-'}</TableCell>
                <TableCell className="whitespace-nowrap">{appt.professional?.full_name || '-'}</TableCell>
                <TableCell>
                  {(appt as any)._plan_name
                    ? (appt as any)._plan_name
                    : APPOINTMENT_TYPES.find(t => t.value === appt.appointment_type)?.label ?? appt.appointment_type}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {(appt as any)._session_number
                    ? `${(appt as any)._session_number} de ${(appt as any)._total_sessions}`
                    : '—'}
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
                {!isClosed && (
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir registro</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o registro de{' '}
                            <strong>{appt.patient?.full_name}</strong> do dia{' '}
                            <strong>{new Date(appt.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>?
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={async () => {
                              const { error } = await deleteAppointment(appt.id)
                              if (error) {
                                toast.error('Erro ao excluir registro.')
                              } else {
                                toast.success('Registro excluído.')
                              }
                            }}
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}
    </div>
  )
}

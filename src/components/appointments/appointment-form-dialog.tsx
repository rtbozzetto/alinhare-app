'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAppointments } from '@/hooks/use-appointments'
import { usePatients } from '@/hooks/use-patients'
import { useProfessionals } from '@/hooks/use-professionals'
import { useUserRole } from '@/hooks/use-user-role'
import { usePriceTables, type ProtocolKey } from '@/hooks/use-price-tables'
import { createClient } from '@/lib/supabase/client'
import { type Appointment, type TreatmentPlan, type TreatmentSession } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  APPOINTMENT_TYPES,
  APPOINTMENT_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  LEAD_SOURCES,
  SCHEDULE,
} from '@/lib/constants'
import { formatCurrency, calculateCommission, applyCreditCardFee } from '@/lib/utils'
import { toast } from 'sonner'
import { Save, Trash2, Search, CalendarPlus } from 'lucide-react'

interface AppointmentFormDialogProps {
  open: boolean
  onClose: () => void
  appointment?: Appointment | null
  defaultDate?: string
  defaultTime?: string
  defaultPatientId?: string
  defaultPatientName?: string
  defaultProfessionalId?: string
  defaultSessionId?: string
  onSwitchToBatch?: () => void
}

export function AppointmentFormDialog({
  open,
  onClose,
  appointment,
  defaultDate,
  defaultTime,
  defaultPatientId,
  defaultPatientName,
  defaultProfessionalId,
  defaultSessionId,
  onSwitchToBatch,
}: AppointmentFormDialogProps) {
  const { createAppointment, updateAppointment, deleteAppointment } = useAppointments()
  const { patients } = usePatients()
  const { activeProfessionals } = useProfessionals()
  const { isAdmin, professionalId } = useUserRole()
  const { grouped, getEvaluationPrice, getPlanOptions } = usePriceTables()

  const supabase = createClient()
  const isEdit = !!appointment

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const [conflictWarning, setConflictWarning] = useState<string | null>(null)
  const [conflictConfirmed, setConflictConfirmed] = useState(false)

  // Active plan tracking
  const [activePlan, setActivePlan] = useState<TreatmentPlan | null>(null)
  const [nextSession, setNextSession] = useState<{ number: number; total: number } | null>(null)

  // Existing appointments for patient
  const [existingAppts, setExistingAppts] = useState<Array<{ id: string; date: string; time: string; type: string }>>([])
  const [showExistingAlert, setShowExistingAlert] = useState(false)

  const [form, setForm] = useState({
    patient_id: '',
    professional_id: '',
    appointment_date: '',
    appointment_time: '',
    appointment_type: 'avaliacao' as Appointment['appointment_type'],
    notes: '',
    status: 'agendada' as Appointment['status'],
    payment_status: 'nao_pago' as Appointment['payment_status'],
    payment_method: 'pix' as Appointment['payment_method'],
    custom_price: 0,
    discount_amount: 0,
    discount_type: 'value' as Appointment['discount_type'],
    lead_source: 'clinica' as Appointment['lead_source'],
    lead_professional_id: null as string | null,
  })

  useEffect(() => {
    if (appointment) {
      setForm({
        patient_id: appointment.patient_id,
        professional_id: appointment.professional_id,
        appointment_date: appointment.appointment_date,
        appointment_time: appointment.appointment_time?.slice(0, 5) ?? '',
        appointment_type: appointment.appointment_type,
        notes: appointment.notes ?? '',
        status: appointment.status,
        payment_status: appointment.payment_status,
        payment_method: appointment.payment_method,
        custom_price: appointment.custom_price ?? 0,
        discount_amount: appointment.discount_amount,
        discount_type: appointment.discount_type,
        lead_source: appointment.lead_source,
        lead_professional_id: appointment.lead_professional_id,
      })
      setPatientSearch(appointment.patient?.full_name ?? '')
    } else {
      setForm(prev => ({
        ...prev,
        patient_id: defaultPatientId ?? '',
        professional_id: defaultProfessionalId ?? professionalId ?? '',
        appointment_date: defaultDate ?? '',
        appointment_time: defaultTime ?? '',
        appointment_type: 'avaliacao',
        notes: '',
        status: 'agendada',
        payment_status: 'nao_pago',
        payment_method: 'pix',
        custom_price: 0,
        discount_amount: 0,
        discount_type: 'value',
        lead_source: 'clinica',
        lead_professional_id: null,
      }))
      setPatientSearch(defaultPatientName ?? '')
      if (defaultPatientId) {
        fetchActivePlan(defaultPatientId)
      }
    }
  }, [appointment, defaultDate, defaultTime, defaultPatientId, defaultPatientName, defaultProfessionalId, defaultSessionId, professionalId])

  function updateField(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
    // Reset conflict state when relevant fields change
    if (['professional_id', 'appointment_date', 'appointment_time'].includes(field)) {
      setConflictWarning(null)
      setConflictConfirmed(false)
    }
  }

  // When appointment type changes, update price from price tables
  function handleTypeChange(type: string) {
    updateField('appointment_type', type)
    if (isEdit) return

    // Determine protocol from selected professional
    const prof = activeProfessionals.find(p => p.id === form.professional_id)
    const nameLC = prof?.full_name?.toLowerCase() || ''
    const protocol: ProtocolKey = (nameLC.includes('janaina') || nameLC.includes('janaína') || nameLC.includes('janain')) ? 'janaina' : 'quiropraxistas'

    if (type === 'avaliacao') {
      const evalPrice = getEvaluationPrice(protocol)
      updateField('custom_price', evalPrice)
      updateField('payment_status', 'nao_pago')
    } else if (type === 'tratamento') {
      // Use active plan if available
      if (activePlan && activePlan.plan_type === 'treatment') {
        const isPaid = activePlan.payment_status === 'pago' || activePlan.payment_status === 'pago_pacote'
        updateField('custom_price', isPaid ? 0 : (activePlan.total_sessions > 0
          ? Math.round((activePlan.final_paid_amount ?? activePlan.price) / activePlan.total_sessions * 100) / 100
          : 0))
        updateField('payment_status', isPaid ? 'pago_pacote' : 'nao_pago')
      } else {
        const options = getPlanOptions(protocol, 'treatment')
        const recommended = options.find(o => o.recommended) || options[0]
        if (recommended) {
          updateField('custom_price', Math.round(recommended.price / recommended.sessions * 100) / 100)
        }
      }
    } else if (type === 'manutencao') {
      if (activePlan && activePlan.plan_type === 'maintenance') {
        const isPaid = activePlan.payment_status === 'pago' || activePlan.payment_status === 'pago_pacote'
        updateField('custom_price', isPaid ? 0 : (activePlan.total_sessions > 0
          ? Math.round((activePlan.final_paid_amount ?? activePlan.price) / activePlan.total_sessions * 100) / 100
          : 0))
        updateField('payment_status', isPaid ? 'pago_pacote' : 'nao_pago')
      } else {
        const options = getPlanOptions(protocol, 'maintenance')
        const recommended = options.find(o => o.recommended) || options[0]
        if (recommended) {
          updateField('custom_price', Math.round(recommended.price / recommended.sessions * 100) / 100)
        }
      }
    }
  }

  // Fetch active plan and existing appointments when patient is selected (new appointments only)
  async function fetchActivePlan(patientId: string) {
    if (isEdit) return

    // Check for existing upcoming appointments for this patient
    const today = new Date().toISOString().split('T')[0]
    const { data: existingData } = await supabase
      .from('appointments')
      .select('id, appointment_date, appointment_time, appointment_type')
      .eq('patient_id', patientId)
      .gte('appointment_date', today)
      .neq('status', 'cancelada')
      .order('appointment_date')

    if (existingData && existingData.length > 0) {
      setExistingAppts(existingData.map(a => ({
        id: a.id,
        date: a.appointment_date,
        time: a.appointment_time?.slice(0, 5) ?? '',
        type: a.appointment_type,
      })))
      setShowExistingAlert(true)
    } else {
      setExistingAppts([])
      setShowExistingAlert(false)
    }

    const { data: plans } = await supabase
      .from('treatment_plans')
      .select('*')
      .eq('patient_id', patientId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)

    if (plans && plans.length > 0) {
      const plan = plans[0]
      setActivePlan(plan)

      // Find the session being scheduled
      if (defaultSessionId) {
        // Specific session selected (from sessions tab)
        const { data: specificSession } = await supabase
          .from('treatment_sessions')
          .select('session_number')
          .eq('id', defaultSessionId)
          .single()
        if (specificSession) {
          setNextSession({ number: specificSession.session_number, total: plan.total_sessions })
        } else {
          setNextSession(null)
        }
      } else {
        // Fallback: find next pending session
        const { data: sessions } = await supabase
          .from('treatment_sessions')
          .select('*')
          .eq('plan_id', plan.id)
          .eq('completed', false)
          .order('session_number')
          .limit(1)

        if (sessions && sessions.length > 0) {
          setNextSession({ number: sessions[0].session_number, total: plan.total_sessions })
        } else {
          setNextSession(null)
        }
      }

      // Auto-fill form fields from active plan
      const typeMap: Record<string, Appointment['appointment_type']> = {
        treatment: 'tratamento',
        maintenance: 'manutencao',
        avaliacao: 'avaliacao',
      }
      const appointmentType = typeMap[plan.plan_type] || 'tratamento'
      const isPlanPaid = plan.payment_status === 'pago' || plan.payment_status === 'pago_pacote'
      setForm(prev => ({
        ...prev,
        professional_id: plan.professional_id,
        appointment_type: appointmentType,
        payment_status: isPlanPaid ? 'pago_pacote' : 'nao_pago',
        payment_method: plan.payment_method,
        custom_price: isPlanPaid ? 0 : (plan.total_sessions > 0
          ? Math.round((plan.final_paid_amount ?? plan.price) / plan.total_sessions * 100) / 100
          : 0),
        discount_amount: 0,
        discount_type: 'value',
        lead_source: plan.lead_source,
        lead_professional_id: plan.lead_professional_id,
      }))
    } else {
      setActivePlan(null)
      setNextSession(null)
    }
  }

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients.slice(0, 10)
    const q = patientSearch.toLowerCase()
    return patients.filter(p => p.full_name.toLowerCase().includes(q)).slice(0, 10)
  }, [patients, patientSearch])

  const timeSlots = useMemo(() => {
    const slots: string[] = []
    for (let h = SCHEDULE.START_HOUR; h < SCHEDULE.END_HOUR; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`)
      slots.push(`${String(h).padStart(2, '0')}:30`)
    }
    return slots
  }, [])

  // Calculate final amounts
  const discountValue =
    form.discount_type === 'percent'
      ? (form.custom_price * form.discount_amount) / 100
      : form.discount_amount
  const afterDiscount = Math.max(0, form.custom_price - discountValue)
  const finalAmount = form.payment_method === 'cartao' ? applyCreditCardFee(afterDiscount) : afterDiscount
  const selectedProfessionalName = activeProfessionals.find(p => p.id === form.professional_id)?.full_name
  // When "pago no pacote", commission is zero (already accounted in the plan)
  const isPagoPacote = form.payment_status === 'pago_pacote'
  const commission = isPagoPacote
    ? { professionalPercent: 0, clinicPercent: 0, professionalAmount: 0, clinicAmount: 0 }
    : calculateCommission(finalAmount, form.lead_source, selectedProfessionalName)

  async function checkConflict(): Promise<string | null> {
    const { data } = await supabase
      .from('appointments')
      .select('id, appointment_time, patient:patients(full_name)')
      .eq('professional_id', form.professional_id)
      .eq('appointment_date', form.appointment_date)
      .eq('appointment_time', form.appointment_time)
      .neq('status', 'cancelada')

    const existing = isEdit
      ? data?.filter(a => a.id !== appointment?.id)
      : data

    if (existing && existing.length > 0) {
      const names = existing
        .map(a => (a.patient as any)?.full_name || 'Paciente')
        .join(', ')
      return `Já existe agendamento neste horário com: ${names}`
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.patient_id) {
      toast.error('Selecione um paciente.')
      return
    }
    if (!form.professional_id) {
      toast.error('Selecione um profissional.')
      return
    }
    if (!form.appointment_date || !form.appointment_time) {
      toast.error('Data e horario sao obrigatorios.')
      return
    }

    // Check past date
    const today = new Date().toISOString().split('T')[0]
    if (form.appointment_date < today) {
      toast.error('Não é possível agendar em uma data que já passou.')
      return
    }

    // Check for conflicts (skip if user already confirmed)
    if (!conflictConfirmed) {
      const conflict = await checkConflict()
      if (conflict) {
        setConflictWarning(conflict)
        return
      }
    }

    const payload: Partial<Appointment> = {
      patient_id: form.patient_id,
      professional_id: form.professional_id,
      appointment_date: form.appointment_date,
      appointment_time: form.appointment_time,
      appointment_type: form.appointment_type,
      notes: form.notes || null,
      status: form.status,
      payment_status: form.payment_status,
      payment_method: form.payment_method,
      custom_price: form.custom_price,
      discount_amount: form.discount_amount,
      discount_type: form.discount_type,
      final_paid_amount: finalAmount,
      lead_source: form.lead_source,
      lead_professional_id: form.lead_professional_id || null,
      commission_percentage: commission.professionalPercent,
      commission_amount: commission.professionalAmount,
      clinic_amount: commission.clinicAmount,
    }

    setSaving(true)
    if (isEdit) {
      const { error } = await updateAppointment(appointment.id, payload)
      setSaving(false)
      if (error) {
        toast.error(`Erro ao atualizar agendamento: ${error.message || 'erro desconhecido'}`)
      } else {
        toast.success('Agendamento atualizado!')
        setConflictWarning(null)
        setConflictConfirmed(false)
        onClose()
      }
    } else {
      const { error } = await createAppointment(payload)
      setSaving(false)
      if (error) {
        toast.error(`Erro ao criar agendamento: ${error.message || 'erro desconhecido'}`)
      } else {
        // Sync session date with appointment date
        if (form.appointment_date) {
          try {
            if (defaultSessionId) {
              // Update the specific session that was selected
              const { error: syncErr } = await supabase
                .from('treatment_sessions')
                .update({ session_date: form.appointment_date })
                .eq('id', defaultSessionId)
              if (syncErr) console.error('Session date sync error:', syncErr)
            } else if (activePlan) {
              // Fallback: update next pending session
              const { data: pendingSessions } = await supabase
                .from('treatment_sessions')
                .select('id')
                .eq('plan_id', activePlan.id)
                .eq('completed', false)
                .is('session_date', null)
                .order('session_number')
                .limit(1)
              if (pendingSessions && pendingSessions.length > 0) {
                const { error: syncErr } = await supabase
                  .from('treatment_sessions')
                  .update({ session_date: form.appointment_date })
                  .eq('id', pendingSessions[0].id)
                if (syncErr) console.error('Session date sync error:', syncErr)
              }
            }
          } catch (syncError) {
            console.error('Session date sync failed:', syncError)
          }
        }
        toast.success('Agendamento criado!')
        setConflictWarning(null)
        setConflictConfirmed(false)
        onClose()
      }
    }
  }

  async function handleDelete() {
    if (!appointment) return
    setDeleting(true)
    const { error } = await deleteAppointment(appointment.id)
    setDeleting(false)
    if (error) {
      toast.error('Erro ao excluir agendamento.')
    } else {
      toast.success('Agendamento excluido.')
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={val => !val && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-[95vw] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
        </DialogHeader>

        {!isEdit && onSwitchToBatch && (
          <button
            type="button"
            onClick={onSwitchToBatch}
            className="flex items-center gap-2 w-full rounded-md border border-dashed border-teal-300 bg-teal-50 px-3 py-2 text-sm text-teal-700 hover:bg-teal-100 transition-colors"
          >
            <CalendarPlus className="h-4 w-4" />
            Agendar em lote (múltiplas sessões)
          </button>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Patient search */}
          <div className="space-y-2">
            <Label>Paciente *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar paciente..."
                value={patientSearch}
                onChange={e => {
                  setPatientSearch(e.target.value)
                  if (!e.target.value) updateField('patient_id', '')
                }}
                className="pl-10"
              />
            </div>
            {patientSearch && !form.patient_id && (
              <div className="max-h-32 overflow-y-auto rounded-md border">
                {filteredPatients.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      updateField('patient_id', p.id)
                      setPatientSearch(p.full_name)
                      fetchActivePlan(p.id)
                    }}
                  >
                    {p.full_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
            {/* Professional */}
            <div className="space-y-2">
              <Label>Profissional *</Label>
              <Select
                value={form.professional_id}
                onValueChange={(value: string) => updateField('professional_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {activeProfessionals.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.appointment_type}
                onValueChange={(value: string) => handleTypeChange(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPOINTMENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                type="date"
                value={form.appointment_date}
                onChange={e => updateField('appointment_date', e.target.value)}
                required
              />
            </div>

            {/* Time */}
            <div className="space-y-2">
              <Label>Horario *</Label>
              <Select
                value={form.appointment_time}
                onValueChange={(value: string) => updateField('appointment_time', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Horario" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Session indicator from active plan */}
            {nextSession && !isEdit && (
              <div className="space-y-2">
                <Label>Sessão do Plano</Label>
                <div className="flex h-9 items-center rounded-md border bg-teal-50 px-3 text-sm font-medium text-teal-700">
                  Sessão {nextSession.number} de {nextSession.total}
                </div>
              </div>
            )}


            {/* Status (edit only) */}
            {isEdit && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value: string) => updateField('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPOINTMENT_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observacoes</Label>
            <Textarea
              value={form.notes}
              onChange={e => updateField('notes', e.target.value)}
              rows={2}
            />
          </div>

          {/* Active plan indicator */}
          {activePlan && !isEdit && (
            <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
              <span className="font-medium">Plano ativo:</span> {activePlan.plan_name} — {activePlan.total_sessions} sessoes ({activePlan.payment_status === 'pago' ? 'Pago' : activePlan.payment_status === 'pago_pacote' ? 'Pago (pacote)' : 'Nao pago'})
            </div>
          )}

          {/* Existing appointments alert */}
          {showExistingAlert && existingAppts.length > 0 && !isEdit && (
            <div className="rounded-md border border-orange-300 bg-orange-50 p-3 space-y-2">
              <p className="text-sm font-medium text-orange-800">⚠ Este paciente já possui {existingAppts.length} agendamento(s) futuro(s):</p>
              <div className="max-h-40 overflow-y-auto rounded border divide-y bg-white">
                {existingAppts.map(a => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between px-2 sm:px-3 py-1.5 text-sm gap-1 sm:gap-2">
                    <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                      <span className="font-medium text-xs sm:text-sm whitespace-nowrap">
                        {new Date(a.date + 'T12:00:00').toLocaleDateString('pt-BR')} às {a.time}
                      </span>
                      <span className="text-muted-foreground text-xs truncate hidden sm:inline">
                        {APPOINTMENT_TYPES.find(t => t.value === a.type)?.label ?? a.type}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-xs text-orange-700 hover:text-orange-900 hover:bg-orange-100 shrink-0 h-7 px-2"
                      onClick={async () => {
                        // Delete old appointment and pre-fill form with its date/time
                        await supabase.from('appointments').delete().eq('id', a.id)
                        updateField('appointment_date', a.date)
                        updateField('appointment_time', a.time)
                        setExistingAppts(prev => prev.filter(ea => ea.id !== a.id))
                        toast.success('Agendamento removido. Preencha os dados e salve.')
                      }}
                    >
                      Substituir
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-orange-700">Clique em "Substituir" para usar a data/hora de um agendamento existente, ou continue criando um novo.</p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-xs text-orange-600"
                onClick={() => setShowExistingAlert(false)}
              >
                Entendi, criar novo
              </Button>
            </div>
          )}

          {/* Payment section */}
          <div className="space-y-4 rounded-lg border p-4">
            <h3 className="font-medium">Pagamento</h3>
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status de pagamento</Label>
                <Select
                  value={form.payment_status}
                  onValueChange={(value: string) => updateField('payment_status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Metodo</Label>
                <Select
                  value={form.payment_method}
                  onValueChange={(value: string) => updateField('payment_method', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.custom_price || ''}
                  onChange={e => updateField('custom_price', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Desconto ({form.discount_type === 'percent' ? '%' : 'R$'})
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.discount_amount || ''}
                    onChange={e => updateField('discount_amount', parseFloat(e.target.value) || 0)}
                    className="flex-1"
                    placeholder="0.00"
                  />
                  <Select
                    value={form.discount_type}
                    onValueChange={(value: string) => updateField('discount_type', value)}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="value">R$</SelectItem>
                      <SelectItem value="percent">%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Origem do Lead</Label>
                <Select
                  value={form.lead_source}
                  onValueChange={(value: string) => {
                    updateField('lead_source', value)
                    if (value === 'profissional' && !form.lead_professional_id) {
                      updateField('lead_professional_id', form.professional_id)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map(l => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.lead_source === 'profissional' && (
                <div className="space-y-2">
                  <Label>Profissional responsavel</Label>
                  <Select
                    value={form.lead_professional_id ?? ''}
                    onValueChange={(value: string) => updateField('lead_professional_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activeProfessionals.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Commission summary */}
            <div className="mt-3 rounded-md bg-gray-50 p-3 text-sm">
              <div className="flex justify-between">
                <span>Valor bruto:</span>
                <span>{formatCurrency(form.custom_price)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Desconto:</span>
                <span>- {formatCurrency(discountValue)}</span>
              </div>
              {form.payment_method === 'cartao' && (
                <div className="flex justify-between text-orange-600">
                  <span>Taxa cartao (5,99%):</span>
                  <span>- {formatCurrency(afterDiscount - finalAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-medium text-teal-600">
                <span>Valor liquido:</span>
                <span>{formatCurrency(finalAmount)}</span>
              </div>
              <div className="mt-1 border-t pt-1 flex justify-between">
                <span>Repasse profissional ({commission.professionalPercent}%):</span>
                <span>{formatCurrency(commission.professionalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Clinica ({commission.clinicPercent}%):</span>
                <span>{formatCurrency(commission.clinicAmount)}</span>
              </div>
            </div>
          </div>

          {/* Conflict warning */}
          {conflictWarning && (
            <div className="rounded-md border border-orange-300 bg-orange-50 p-3 space-y-2">
              <p className="text-sm font-medium text-orange-800">⚠ Conflito de horário</p>
              <p className="text-sm text-orange-700">{conflictWarning}</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setConflictWarning(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700"
                  onClick={() => setConflictConfirmed(true)}
                >
                  Agendar mesmo assim
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deleting ? 'Excluindo...' : 'Excluir'}
              </Button>
            )}
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

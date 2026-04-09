'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAppointments } from '@/hooks/use-appointments'
import { usePatients } from '@/hooks/use-patients'
import { useProfessionals } from '@/hooks/use-professionals'
import { useUserRole } from '@/hooks/use-user-role'
import { usePriceTables, type ProtocolKey } from '@/hooks/use-price-tables'
import { type Appointment } from '@/types/database'
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
import { Save, Trash2, Search } from 'lucide-react'

interface AppointmentFormDialogProps {
  open: boolean
  onClose: () => void
  appointment?: Appointment | null
  defaultDate?: string
  defaultTime?: string
}

export function AppointmentFormDialog({
  open,
  onClose,
  appointment,
  defaultDate,
  defaultTime,
}: AppointmentFormDialogProps) {
  const { createAppointment, updateAppointment, deleteAppointment } = useAppointments()
  const { patients } = usePatients()
  const { activeProfessionals } = useProfessionals()
  const { isAdmin, professionalId } = useUserRole()
  const { grouped, getEvaluationPrice, getPlanOptions } = usePriceTables()

  const isEdit = !!appointment

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')

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
    lead_professional_id: '' as string | null,
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
        patient_id: '',
        professional_id: professionalId ?? '',
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
      setPatientSearch('')
    }
  }, [appointment, defaultDate, defaultTime, professionalId])

  function updateField(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
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
  const commission = calculateCommission(finalAmount, form.lead_source, selectedProfessionalName)

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
        toast.error('Erro ao atualizar agendamento.')
      } else {
        toast.success('Agendamento atualizado!')
        onClose()
      }
    } else {
      const { error } = await createAppointment(payload)
      setSaving(false)
      if (error) {
        toast.error('Erro ao criar agendamento.')
      } else {
        toast.success('Agendamento criado!')
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
        </DialogHeader>

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
                    }}
                  >
                    {p.full_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
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
                onValueChange={(value: string) => updateField('appointment_type', value)}
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

          {/* Payment section */}
          <div className="space-y-4 rounded-lg border p-4">
            <h3 className="font-medium">Pagamento</h3>
            <div className="grid gap-4 md:grid-cols-2">
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
                  value={form.custom_price}
                  onChange={e => updateField('custom_price', parseFloat(e.target.value) || 0)}
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
                    value={form.discount_amount}
                    onChange={e => updateField('discount_amount', parseFloat(e.target.value) || 0)}
                    className="flex-1"
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
                  onValueChange={(value: string) => updateField('lead_source', value)}
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

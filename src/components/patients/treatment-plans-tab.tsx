'use client'

import { useEffect, useState } from 'react'
import { useTreatmentPlans } from '@/hooks/use-treatment-plans'
import { useProfessionals } from '@/hooks/use-professionals'
import { useUserRole } from '@/hooks/use-user-role'
import { usePriceTables, type ProtocolKey } from '@/hooks/use-price-tables'
import { type TreatmentPlan } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { PAYMENT_STATUSES, PAYMENT_METHODS, LEAD_SOURCES, SCHEDULE } from '@/lib/constants'
import { formatCurrency, calculateCommission, applyCreditCardFee } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { AppointmentFormDialog } from '@/components/appointments/appointment-form-dialog'
import { Plus, Trash2, Pencil, CalendarPlus, Calendar, X } from 'lucide-react'
import { addDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const PLAN_TYPE_LABELS: Record<string, string> = {
  treatment: 'Tratamento',
  maintenance: 'Manutenção',
  avaliacao: 'Avaliação',
}

interface TreatmentPlansTabProps {
  patientId: string
  patientName?: string
  autoOpenCreate?: boolean
  onAutoOpenHandled?: () => void
}

export function TreatmentPlansTab({ patientId, patientName, autoOpenCreate, onAutoOpenHandled }: TreatmentPlansTabProps) {
  const { plans, sessions, loading, fetchPlans, fetchSessions, createPlan, updatePlan, deletePlan } = useTreatmentPlans(patientId)
  const { activeProfessionals } = useProfessionals()
  const { professionalId, isAdmin } = useUserRole()
  const { grouped, getEvaluationPrice, getPlanOptions } = usePriceTables()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<TreatmentPlan | null>(null)
  const [saving, setSaving] = useState(false)

  // Post-creation scheduling prompt
  const [schedulePromptOpen, setSchedulePromptOpen] = useState(false)
  const [createdPlan, setCreatedPlan] = useState<TreatmentPlan | null>(null)
  const [singleAppointmentOpen, setSingleAppointmentOpen] = useState(false)

  // Batch scheduling state
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [schedulingPlan, setSchedulingPlan] = useState<TreatmentPlan | null>(null)
  const [scheduleDays, setScheduleDays] = useState<Record<number, string>>({}) // dayOfWeek -> time
  const [scheduleStartDate, setScheduleStartDate] = useState(new Date().toISOString().split('T')[0])
  const [schedulePreview, setSchedulePreview] = useState<Array<{ date: string; time: string; label: string }>>([])
  const [savingSchedule, setSavingSchedule] = useState(false)

  const [form, setForm] = useState({
    professional_id: professionalId ?? '',
    plan_type: 'treatment' as TreatmentPlan['plan_type'],
    protocol: 'janaina' as ProtocolKey,
    selected_price_id: '',
    plan_name: '',
    total_sessions: 1,
    notes: '',
    price: 0,
    payment_status: 'nao_pago' as TreatmentPlan['payment_status'],
    payment_method: 'pix' as TreatmentPlan['payment_method'],
    discount_amount: 0,
    discount_type: 'value' as TreatmentPlan['discount_type'],
    lead_source: 'clinica' as TreatmentPlan['lead_source'],
    lead_professional_id: null as string | null,
  })

  const [editForm, setEditForm] = useState({
    professional_id: '',
    plan_type: 'treatment' as TreatmentPlan['plan_type'],
    protocol: 'janaina' as ProtocolKey,
    selected_price_id: '',
    plan_name: '',
    total_sessions: 1,
    start_date: '',
    notes: '',
    price: 0,
    payment_status: 'nao_pago' as TreatmentPlan['payment_status'],
    payment_method: 'pix' as TreatmentPlan['payment_method'],
    discount_amount: 0,
    discount_type: 'value' as TreatmentPlan['discount_type'],
    lead_source: 'clinica' as TreatmentPlan['lead_source'],
    lead_professional_id: null as string | null,
    active: true,
  })

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  useEffect(() => {
    if (plans.length > 0) fetchSessions()
  }, [plans, fetchSessions])

  useEffect(() => {
    if (autoOpenCreate) {
      openCreateDialog()
      onAutoOpenHandled?.()
    }
  }, [autoOpenCreate])

  function updateField(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function getProtocolForProfessional(profId: string): ProtocolKey {
    const prof = activeProfessionals.find(p => p.id === profId)
    if (prof && prof.full_name.toLowerCase().includes('janaina')) return 'janaina'
    if (prof && prof.full_name.toLowerCase().includes('janaína')) return 'janaina'
    return 'quiropraxistas'
  }

  function handleProfessionalChange(profId: string) {
    updateField('professional_id', profId)
    const proto = getProtocolForProfessional(profId)
    // Reset plan selection when professional changes
    updateField('protocol', proto)
    updateField('selected_price_id', '')
    updateField('plan_name', '')
    updateField('total_sessions', 1)
    updateField('price', 0)
    // Re-apply evaluation price if type is avaliacao
    if (form.plan_type === 'avaliacao') {
      updateField('plan_name', 'Avaliação')
      updateField('price', getEvaluationPrice(proto))
    }
  }

  function handlePlanTypeChange(type: string) {
    updateField('plan_type', type)
    updateField('selected_price_id', '')
    if (type === 'avaliacao') {
      const evalPrice = getEvaluationPrice(form.protocol)
      updateField('plan_name', 'Avaliação')
      updateField('total_sessions', 1)
      updateField('price', evalPrice)
    } else {
      updateField('plan_name', '')
      updateField('total_sessions', 1)
      updateField('price', 0)
    }
  }

  function handlePriceOptionChange(priceId: string) {
    updateField('selected_price_id', priceId)
    const planType = form.plan_type === 'avaliacao' ? 'treatment' : form.plan_type as 'treatment' | 'maintenance'
    const options = getPlanOptions(form.protocol, planType)
    const option = options.find(o => o.id === priceId)
    if (option) {
      updateField('plan_name', option.plan_name)
      updateField('total_sessions', option.sessions)
      updateField('price', option.price)
    }
  }

  const discountValue =
    form.discount_type === 'percent'
      ? (form.price * form.discount_amount) / 100
      : form.discount_amount
  const afterDiscount = Math.max(0, form.price - discountValue)
  const finalAmount = form.payment_method === 'cartao' ? applyCreditCardFee(afterDiscount) : afterDiscount
  const selectedProfessionalName = activeProfessionals.find(p => p.id === form.professional_id)?.full_name
  const commission = calculateCommission(finalAmount, form.lead_source, selectedProfessionalName)

  function openCreateDialog() {
    const defaultProfId = professionalId ?? ''
    const defaultProto = defaultProfId ? getProtocolForProfessional(defaultProfId) : 'janaina'
    setForm({
      professional_id: defaultProfId,
      plan_type: 'treatment',
      protocol: defaultProto,
      selected_price_id: '',
      plan_name: '',
      total_sessions: 1,
      notes: '',
      price: 0,
      payment_status: 'nao_pago',
      payment_method: 'pix',
      discount_amount: 0,
      discount_type: 'value',
      lead_source: 'clinica',
      lead_professional_id: null,
    })
    setDialogOpen(true)
  }

  function openEditDialog(plan: TreatmentPlan) {
    setEditingPlan(plan)
    setEditForm({
      professional_id: plan.professional_id,
      plan_type: plan.plan_type,
      protocol: getProtocolForProfessional(plan.professional_id),
      selected_price_id: '',
      plan_name: plan.plan_name,
      total_sessions: plan.total_sessions,
      start_date: plan.start_date ?? '',
      notes: plan.notes ?? '',
      price: plan.price,
      payment_status: plan.payment_status,
      payment_method: plan.payment_method,
      discount_amount: plan.discount_amount,
      discount_type: plan.discount_type,
      lead_source: plan.lead_source,
      lead_professional_id: plan.lead_professional_id,
      active: plan.active,
    })
    setEditDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.professional_id) {
      toast.error('Selecione um profissional.')
      return
    }
    if (!form.plan_name.trim()) {
      toast.error('Selecione um plano.')
      return
    }

    setSaving(true)
    const { data: newPlan, error } = await createPlan({
      patient_id: patientId,
      professional_id: form.professional_id,
      plan_name: form.plan_name,
      plan_type: form.plan_type,
      total_sessions: form.total_sessions,
      start_date: new Date().toISOString().split('T')[0],
      notes: form.notes || null,
      active: true,
      price: form.price,
      payment_status: form.payment_status,
      payment_method: form.payment_method,
      discount_type: form.discount_type,
      discount_amount: form.discount_amount,
      final_paid_amount: finalAmount,
      lead_source: form.lead_source,
      lead_professional_id: form.lead_professional_id,
      commission_percentage: commission.professionalPercent,
      commission_amount: commission.professionalAmount,
      clinic_amount: commission.clinicAmount,
    })
    setSaving(false)

    if (error) {
      toast.error('Erro ao criar plano.')
    } else {
      toast.success('Plano criado!')
      setDialogOpen(false)
      fetchPlans()
      // Show scheduling prompt
      if (newPlan) {
        setCreatedPlan(newPlan as TreatmentPlan)
        setSchedulePromptOpen(true)
      }
    }
  }

  function updateEditField(field: string, value: unknown) {
    setEditForm(prev => ({ ...prev, [field]: value }))
  }

  function handleEditProtocolChange(proto: string) {
    updateEditField('protocol', proto)
    updateEditField('selected_price_id', '')
  }

  function handleEditPlanTypeChange(type: string) {
    updateEditField('plan_type', type)
    updateEditField('selected_price_id', '')
    if (type === 'avaliacao') {
      const evalPrice = getEvaluationPrice(editForm.protocol)
      updateEditField('plan_name', 'Avaliação')
      updateEditField('total_sessions', 1)
      updateEditField('price', evalPrice)
    }
  }

  function handleEditPriceOptionChange(priceId: string) {
    updateEditField('selected_price_id', priceId)
    const planType = editForm.plan_type === 'avaliacao' ? 'treatment' : editForm.plan_type as 'treatment' | 'maintenance'
    const options = getPlanOptions(editForm.protocol, planType)
    const option = options.find(o => o.id === priceId)
    if (option) {
      updateEditField('plan_name', option.plan_name)
      updateEditField('total_sessions', option.sessions)
      updateEditField('price', option.price)
    }
  }

  // Edit form computed values
  const editDiscountValue = editForm.discount_type === 'percent'
    ? (editForm.price * editForm.discount_amount) / 100
    : editForm.discount_amount
  const editAfterDiscount = Math.max(0, editForm.price - editDiscountValue)
  const editFinalAmount = editForm.payment_method === 'cartao' ? applyCreditCardFee(editAfterDiscount) : editAfterDiscount
  const editProfName = activeProfessionals.find(p => p.id === editForm.professional_id)?.full_name
  const editCommission = calculateCommission(editFinalAmount, editForm.lead_source, editProfName)

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingPlan) return

    if (!editForm.professional_id) {
      toast.error('Selecione um profissional.')
      return
    }
    if (!editForm.plan_name.trim()) {
      toast.error('Selecione um plano.')
      return
    }

    setSaving(true)

    const needsMoreSessions = editForm.total_sessions > editingPlan.total_sessions

    const { error } = await updatePlan(editingPlan.id, {
      professional_id: editForm.professional_id,
      plan_name: editForm.plan_name,
      plan_type: editForm.plan_type,
      total_sessions: editForm.total_sessions,
      start_date: editForm.start_date || undefined,
      payment_status: editForm.payment_status,
      payment_method: editForm.payment_method,
      price: editForm.price,
      discount_amount: editForm.discount_amount,
      discount_type: editForm.discount_type,
      notes: editForm.notes || null,
      active: editForm.active,
      lead_source: editForm.lead_source,
      lead_professional_id: editForm.lead_professional_id,
      final_paid_amount: editFinalAmount,
      commission_percentage: editCommission.professionalPercent,
      commission_amount: editCommission.professionalAmount,
      clinic_amount: editCommission.clinicAmount,
    })

    // If total_sessions increased, create additional sessions
    if (!error && needsMoreSessions) {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const existingCount = editingPlan.total_sessions
      const startDate = editForm.start_date ? new Date(editForm.start_date + 'T12:00:00') : new Date()
      const newSessions = Array.from(
        { length: editForm.total_sessions - existingCount },
        (_, i) => {
          const sessionDate = new Date(startDate)
          sessionDate.setDate(sessionDate.getDate() + (existingCount + i) * 7)
          return {
            plan_id: editingPlan.id,
            patient_id: patientId,
            professional_id: editForm.professional_id,
            session_number: existingCount + i + 1,
            session_date: sessionDate.toISOString().split('T')[0],
          }
        }
      )
      await supabase.from('treatment_sessions').insert(newSessions)
    }

    setSaving(false)

    if (error) {
      toast.error('Erro ao atualizar plano.')
    } else {
      toast.success('Plano atualizado!')
      setEditDialogOpen(false)
      fetchPlans()
      fetchSessions()
    }
  }

  // ── Batch Scheduling ──

  const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  function openScheduleDialog(plan: TreatmentPlan) {
    setSchedulingPlan(plan)
    setScheduleDays({})
    setScheduleStartDate(new Date().toISOString().split('T')[0])
    setSchedulePreview([])
    setScheduleDialogOpen(true)
  }

  function toggleScheduleDay(day: number) {
    setScheduleDays(prev => {
      const next = { ...prev }
      if (next[day] !== undefined) {
        delete next[day]
      } else {
        next[day] = '10:00'
      }
      return next
    })
  }

  function setScheduleTime(day: number, time: string) {
    setScheduleDays(prev => ({ ...prev, [day]: time }))
  }

  function generateSchedulePreview() {
    if (!schedulingPlan) return
    const planSessions = sessions.filter(s => s.plan_id === schedulingPlan.id)
    const pendingSessions = planSessions.filter(s => !s.completed).length
    const sessionsToSchedule = pendingSessions || schedulingPlan.total_sessions

    const selectedDays = Object.entries(scheduleDays)
      .map(([d, t]) => ({ day: parseInt(d), time: t }))
      .sort((a, b) => a.day - b.day)

    if (selectedDays.length === 0) {
      toast.error('Selecione pelo menos um dia da semana.')
      return
    }

    const preview: Array<{ date: string; time: string; label: string }> = []
    const start = new Date(scheduleStartDate + 'T12:00:00')
    let currentDate = start
    let count = 0

    // Generate dates cycling through selected days
    for (let week = 0; count < sessionsToSchedule && week < 52; week++) {
      for (const { day, time } of selectedDays) {
        if (count >= sessionsToSchedule) break
        // Find the next occurrence of this day of week from start
        let target: Date
        if (week === 0) {
          const startDay = start.getDay()
          const diff = day >= startDay ? day - startDay : 7 - startDay + day
          target = addDays(start, diff)
        } else {
          const weekStart = addDays(start, week * 7)
          const wDay = weekStart.getDay()
          const diff = day >= wDay ? day - wDay : 7 - wDay + day
          target = addDays(weekStart, diff)
        }
        if (target >= start) {
          preview.push({
            date: format(target, 'yyyy-MM-dd'),
            time,
            label: format(target, "EEE, dd/MM", { locale: ptBR }),
          })
          count++
        }
      }
    }

    // Sort by date
    preview.sort((a, b) => a.date.localeCompare(b.date))
    setSchedulePreview(preview)
  }

  function removeFromPreview(index: number) {
    setSchedulePreview(prev => prev.filter((_, i) => i !== index))
  }

  function updatePreviewTime(index: number, time: string) {
    setSchedulePreview(prev => prev.map((item, i) => i === index ? { ...item, time } : item))
  }

  async function handleCreateBatchAppointments() {
    if (!schedulingPlan || schedulePreview.length === 0) return
    setSavingSchedule(true)

    const supabase = createClient()
    const typeMap: Record<string, string> = {
      treatment: 'tratamento',
      maintenance: 'manutencao',
      avaliacao: 'avaliacao',
    }

    let created = 0
    let errors = 0

    for (const item of schedulePreview) {
      const { error } = await supabase.from('appointments').insert({
        patient_id: patientId,
        professional_id: schedulingPlan.professional_id,
        appointment_date: item.date,
        appointment_time: item.time,
        appointment_type: typeMap[schedulingPlan.plan_type] || 'tratamento',
        status: 'agendada',
        payment_status: 'pago_pacote',
        payment_method: schedulingPlan.payment_method,
        custom_price: 0,
        discount_amount: 0,
        discount_type: 'value',
        final_paid_amount: 0,
        lead_source: schedulingPlan.lead_source,
        lead_professional_id: schedulingPlan.lead_professional_id,
        commission_percentage: 0,
        commission_amount: 0,
        clinic_amount: 0,
      })
      if (error) {
        console.error('Batch appointment error:', error)
        errors++
      } else {
        created++
      }
    }

    setSavingSchedule(false)

    if (errors > 0) {
      toast.error(`${errors} agendamento(s) com erro (conflito de horário?). ${created} criado(s).`)
    } else {
      toast.success(`${created} agendamento(s) criado(s) com sucesso!`)
    }
    setScheduleDialogOpen(false)
  }

  async function handleDeletePlan(planId: string) {
    const { error } = await deletePlan(planId)
    if (error) {
      toast.error('Erro ao excluir plano.')
    } else {
      toast.success('Plano excluido.')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    )
  }

  const planTypeOptions = form.plan_type === 'avaliacao'
    ? [] // evaluation doesn't use price options dropdown
    : getPlanOptions(form.protocol, form.plan_type as 'treatment' | 'maintenance')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Planos de Tratamento</h2>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Plano
        </Button>
      </div>

      {plans.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          Nenhum plano cadastrado.
        </div>
      ) : (
        <div className="grid gap-3">
          {plans.map(plan => {
            const statusLabel = PAYMENT_STATUSES.find(s => s.value === plan.payment_status)?.label ?? plan.payment_status
            const planSessions = sessions.filter(s => s.plan_id === plan.id)
            const completedCount = planSessions.filter(s => s.completed).length
            const isFinished = !plan.active && planSessions.length > 0 && planSessions.every(s => s.completed)
            return (
              <Card key={plan.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{plan.plan_name}</span>
                      <Badge variant={isFinished ? 'default' : plan.active ? 'default' : 'secondary'} className={isFinished ? 'bg-green-600' : ''}>
                        {isFinished ? 'Finalizado' : plan.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Badge variant="outline">{statusLabel}</Badge>
                      <Badge variant="outline" className="text-xs">
                        {PLAN_TYPE_LABELS[plan.plan_type] || plan.plan_type}
                      </Badge>
                      {planSessions.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {completedCount}/{plan.total_sessions} sessões
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {plan.total_sessions} sessoes - {formatCurrency(plan.price)}
                      {plan.discount_amount > 0 && ` (desc: ${formatCurrency(plan.discount_amount)})`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {plan.active && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openScheduleDialog(plan)}
                        title="Agendar sessões"
                      >
                        <CalendarPlus className="h-4 w-4 text-teal-600" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(plan)}
                    >
                      <Pencil className="h-4 w-4 text-blue-500" />
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeletePlan(plan.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Plan Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Plano</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Profissional *</Label>
                <Select
                  value={form.professional_id}
                  onValueChange={(value: string) => handleProfessionalChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeProfessionals.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.plan_type}
                  onValueChange={(value: string) => handlePlanTypeChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="avaliacao">Avaliação</SelectItem>
                    <SelectItem value="treatment">Tratamento</SelectItem>
                    <SelectItem value="maintenance">Manutenção</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.plan_type !== 'avaliacao' && (
                <div className="space-y-2">
                  <Label>Plano *</Label>
                  <Select
                    value={form.selected_price_id}
                    onValueChange={(value: string) => handlePriceOptionChange(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um plano..." />
                    </SelectTrigger>
                    <SelectContent>
                      {planTypeOptions.map(opt => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.plan_name} - {opt.sessions} sess. - {formatCurrency(opt.price)}
                          {opt.recommended ? ' (Recomendado)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Sessoes</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.total_sessions}
                  onChange={e => updateField('total_sessions', parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observacoes</Label>
              <Textarea
                value={form.notes}
                onChange={e => updateField('notes', e.target.value)}
                rows={2}
              />
            </div>

            {/* Payment */}
            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="font-medium">Pagamento</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.payment_status}
                    onValueChange={(value: string) => updateField('payment_status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUSES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
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
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
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
                    value={form.price}
                    onChange={e => updateField('price', parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Desconto ({form.discount_type === 'percent' ? '%' : 'R$'})</Label>
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
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
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
                          <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="mt-3 rounded-md bg-gray-50 p-3 text-sm">
                <div className="flex justify-between">
                  <span>Valor bruto:</span>
                  <span>{formatCurrency(form.price)}</span>
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
                  <span>Repasse ({commission.professionalPercent}%):</span>
                  <span>{formatCurrency(commission.professionalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Clinica ({commission.clinicPercent}%):</span>
                  <span>{formatCurrency(commission.clinicAmount)}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={saving}>
                {saving ? 'Salvando...' : 'Criar Plano'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Plan Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Plano</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Profissional *</Label>
                <Select
                  value={editForm.professional_id}
                  onValueChange={(value: string) => {
                    updateEditField('professional_id', value)
                    const proto = getProtocolForProfessional(value)
                    updateEditField('protocol', proto)
                    updateEditField('selected_price_id', '')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeProfessionals.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={editForm.plan_type}
                  onValueChange={(value: string) => handleEditPlanTypeChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="avaliacao">Avaliação</SelectItem>
                    <SelectItem value="treatment">Tratamento</SelectItem>
                    <SelectItem value="maintenance">Manutenção</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editForm.plan_type !== 'avaliacao' && (
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select
                    value={editForm.selected_price_id}
                    onValueChange={(value: string) => handleEditPriceOptionChange(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Alterar plano..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getPlanOptions(editForm.protocol, editForm.plan_type as 'treatment' | 'maintenance').map(opt => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.plan_name} - {opt.sessions} sess. - {formatCurrency(opt.price)}
                          {opt.recommended ? ' (Recomendado)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Sessoes</Label>
                <Input
                  type="number"
                  min={editingPlan?.total_sessions ?? 1}
                  value={editForm.total_sessions}
                  onChange={e => updateEditField('total_sessions', parseInt(e.target.value) || 1)}
                />
                {editForm.total_sessions > (editingPlan?.total_sessions ?? 0) && (
                  <p className="text-xs text-amber-600">
                    +{editForm.total_sessions - (editingPlan?.total_sessions ?? 0)} sessão(ões) serão adicionadas
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Status do Plano</Label>
                <Select
                  value={editForm.active ? 'true' : 'false'}
                  onValueChange={(value: string) => updateEditField('active', value === 'true')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Ativo</SelectItem>
                    <SelectItem value="false">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observacoes</Label>
              <Textarea
                value={editForm.notes}
                onChange={e => updateEditField('notes', e.target.value)}
                rows={2}
              />
            </div>

            {/* Payment */}
            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="font-medium">Pagamento</h3>
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editForm.payment_status}
                    onValueChange={(value: string) => updateEditField('payment_status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUSES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Metodo</Label>
                  <Select
                    value={editForm.payment_method}
                    onValueChange={(value: string) => updateEditField('payment_method', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
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
                    value={editForm.price}
                    onChange={e => updateEditField('price', parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Desconto ({editForm.discount_type === 'percent' ? '%' : 'R$'})</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.discount_amount}
                      onChange={e => updateEditField('discount_amount', parseFloat(e.target.value) || 0)}
                      className="flex-1"
                    />
                    <Select
                      value={editForm.discount_type}
                      onValueChange={(value: string) => updateEditField('discount_type', value)}
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
                    value={editForm.lead_source}
                    onValueChange={(value: string) => updateEditField('lead_source', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_SOURCES.map(l => (
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {editForm.lead_source === 'profissional' && (
                  <div className="space-y-2">
                    <Label>Profissional responsavel</Label>
                    <Select
                      value={editForm.lead_professional_id ?? ''}
                      onValueChange={(value: string) => updateEditField('lead_professional_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {activeProfessionals.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="mt-3 rounded-md bg-gray-50 p-3 text-sm">
                <div className="flex justify-between">
                  <span>Valor bruto:</span>
                  <span>{formatCurrency(editForm.price)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Desconto:</span>
                  <span>- {formatCurrency(editDiscountValue)}</span>
                </div>
                {editForm.payment_method === 'cartao' && (
                  <div className="flex justify-between text-orange-600">
                    <span>Taxa cartao (5,99%):</span>
                    <span>- {formatCurrency(editAfterDiscount - editFinalAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-medium text-teal-600">
                  <span>Valor liquido:</span>
                  <span>{formatCurrency(editFinalAmount)}</span>
                </div>
                <div className="mt-1 border-t pt-1 flex justify-between">
                  <span>Repasse ({editCommission.professionalPercent}%):</span>
                  <span>{formatCurrency(editCommission.professionalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Clinica ({editCommission.clinicPercent}%):</span>
                  <span>{formatCurrency(editCommission.clinicAmount)}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Batch Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Agendar Sessões — {schedulingPlan?.plan_name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione os dias da semana e horários. O sistema gerará os agendamentos automaticamente para todas as sessões pendentes do plano.
            </p>

            {/* Day selection */}
            <div className="space-y-2">
              <Label>Dias da semana</Label>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 0].map(day => {
                  const isSelected = scheduleDays[day] !== undefined
                  return (
                    <Button
                      key={day}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className={isSelected ? 'bg-teal-600 hover:bg-teal-700' : ''}
                      onClick={() => toggleScheduleDay(day)}
                    >
                      {DAY_LABELS[day]}
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Time for each selected day */}
            {Object.entries(scheduleDays).length > 0 && (
              <div className="space-y-2">
                <Label>Horário por dia</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(scheduleDays)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([dayStr, time]) => {
                      const day = parseInt(dayStr)
                      return (
                        <div key={day} className="flex items-center gap-2 rounded-md border p-2">
                          <span className="text-sm font-medium w-10">{DAY_LABELS[day]}</span>
                          <Select
                            value={time}
                            onValueChange={(value: string) => setScheduleTime(day, value)}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: (SCHEDULE.END_HOUR - SCHEDULE.START_HOUR) * 2 }, (_, i) => {
                                const h = SCHEDULE.START_HOUR + Math.floor(i / 2)
                                const m = i % 2 === 0 ? '00' : '30'
                                const t = `${String(h).padStart(2, '0')}:${m}`
                                return <SelectItem key={t} value={t}>{t}</SelectItem>
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {/* Start date */}
            <div className="space-y-2">
              <Label>A partir de</Label>
              <Input
                type="date"
                value={scheduleStartDate}
                onChange={e => setScheduleStartDate(e.target.value)}
              />
            </div>

            {/* Generate preview button */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={generateSchedulePreview}
              disabled={Object.keys(scheduleDays).length === 0}
            >
              Gerar Preview dos Agendamentos
            </Button>

            {/* Preview list */}
            {schedulePreview.length > 0 && (
              <div className="space-y-2">
                <Label>Preview ({schedulePreview.length} agendamentos)</Label>
                <div className="max-h-60 overflow-y-auto rounded-lg border divide-y">
                  {schedulePreview.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2">
                      <span className="text-sm font-medium w-8 text-muted-foreground">{i + 1}.</span>
                      <span className="text-sm flex-1 capitalize">{item.label}</span>
                      <Select
                        value={item.time}
                        onValueChange={(value: string) => updatePreviewTime(i, value)}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: (SCHEDULE.END_HOUR - SCHEDULE.START_HOUR) * 2 }, (_, j) => {
                            const h = SCHEDULE.START_HOUR + Math.floor(j / 2)
                            const m = j % 2 === 0 ? '00' : '30'
                            const t = `${String(h).padStart(2, '0')}:${m}`
                            return <SelectItem key={t} value={t}>{t}</SelectItem>
                          })}
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        onClick={() => removeFromPreview(i)}
                        className="text-muted-foreground hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={handleCreateBatchAppointments}
              disabled={savingSchedule || schedulePreview.length === 0}
            >
              <CalendarPlus className="mr-2 h-4 w-4" />
              {savingSchedule
                ? 'Criando...'
                : `Criar ${schedulePreview.length} Agendamento${schedulePreview.length !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post-creation scheduling prompt */}
      <Dialog open={schedulePromptOpen} onOpenChange={setSchedulePromptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Plano criado com sucesso!</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja agendar as sessões agora?
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              className="w-full bg-teal-600 hover:bg-teal-700"
              onClick={() => {
                setSchedulePromptOpen(false)
                setSingleAppointmentOpen(true)
              }}
            >
              <Calendar className="mr-2 h-4 w-4" />
              Agendar próxima sessão
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSchedulePromptOpen(false)
                if (createdPlan) {
                  openScheduleDialog(createdPlan)
                }
              }}
            >
              <CalendarPlus className="mr-2 h-4 w-4" />
              Agendar em lote
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => {
                setSchedulePromptOpen(false)
                setCreatedPlan(null)
              }}
            >
              Depois
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Single appointment dialog (from post-creation prompt) */}
      <AppointmentFormDialog
        open={singleAppointmentOpen}
        onClose={() => {
          setSingleAppointmentOpen(false)
          setCreatedPlan(null)
        }}
        defaultPatientId={patientId}
        defaultPatientName={patientName}
        defaultProfessionalId={createdPlan?.professional_id}
      />
    </div>
  )
}

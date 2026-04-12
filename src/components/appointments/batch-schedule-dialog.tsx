'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePatients } from '@/hooks/use-patients'
import { type TreatmentPlan } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { SCHEDULE } from '@/lib/constants'
import { toast } from 'sonner'
import { CalendarPlus, X, Search } from 'lucide-react'
import { addDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const TIME_SLOTS = Array.from(
  { length: (SCHEDULE.END_HOUR - SCHEDULE.START_HOUR) * 2 },
  (_, i) => {
    const h = SCHEDULE.START_HOUR + Math.floor(i / 2)
    const m = i % 2 === 0 ? '00' : '30'
    return `${String(h).padStart(2, '0')}:${m}`
  }
)

interface BatchScheduleDialogProps {
  open: boolean
  onClose: () => void
  /** If provided, skips patient selection and uses this plan directly */
  plan?: TreatmentPlan | null
  patientId?: string
  pendingSessions?: number
  /** If true, shows a patient search field */
  showPatientSearch?: boolean
}

export function BatchScheduleDialog({
  open,
  onClose,
  plan: externalPlan,
  patientId: externalPatientId,
  pendingSessions: externalPending,
  showPatientSearch,
}: BatchScheduleDialogProps) {
  const supabase = createClient()
  const { patients } = usePatients()

  // Patient search (for agenda mode)
  const [patientSearch, setPatientSearch] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [activePlan, setActivePlan] = useState<TreatmentPlan | null>(null)
  const [planPending, setPlanPending] = useState(0)
  const [loadingPlan, setLoadingPlan] = useState(false)

  // Schedule config
  const [scheduleDays, setScheduleDays] = useState<Record<number, string>>({})
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [preview, setPreview] = useState<Array<{ date: string; time: string; label: string; conflict?: string }>>([])
  const [saving, setSaving] = useState(false)
  const [checkingConflicts, setCheckingConflicts] = useState(false)

  const effectivePlan = externalPlan || activePlan
  const effectivePatientId = externalPatientId || selectedPatientId
  const effectivePending = externalPending || planPending

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients.slice(0, 10)
    const q = patientSearch.toLowerCase()
    return patients.filter(p => p.full_name.toLowerCase().includes(q)).slice(0, 10)
  }, [patients, patientSearch])

  async function handleSelectPatient(pId: string, name: string) {
    setSelectedPatientId(pId)
    setPatientSearch(name)
    setLoadingPlan(true)

    const { data: plans } = await supabase
      .from('treatment_plans')
      .select('*')
      .eq('patient_id', pId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)

    if (plans && plans.length > 0) {
      const plan = plans[0]
      setActivePlan(plan)

      const { count } = await supabase
        .from('treatment_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('plan_id', plan.id)
        .eq('completed', false)

      setPlanPending(count ?? plan.total_sessions)
    } else {
      setActivePlan(null)
      setPlanPending(0)
      toast.error('Paciente sem plano ativo.')
    }
    setLoadingPlan(false)
  }

  function toggleDay(day: number) {
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

  function setDayTime(day: number, time: string) {
    setScheduleDays(prev => ({ ...prev, [day]: time }))
  }

  async function generatePreview() {
    if (!effectivePlan) return
    const sessionsToSchedule = effectivePending || effectivePlan.total_sessions

    const selectedDays = Object.entries(scheduleDays)
      .map(([d, t]) => ({ day: parseInt(d), time: t }))
      .sort((a, b) => a.day - b.day)

    if (selectedDays.length === 0) {
      toast.error('Selecione pelo menos um dia da semana.')
      return
    }

    const items: Array<{ date: string; time: string; label: string }> = []
    const start = new Date(startDate + 'T12:00:00')
    let count = 0

    for (let week = 0; count < sessionsToSchedule && week < 52; week++) {
      for (const { day, time } of selectedDays) {
        if (count >= sessionsToSchedule) break
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
          items.push({
            date: format(target, 'yyyy-MM-dd'),
            time,
            label: format(target, "EEE, dd/MM", { locale: ptBR }),
          })
          count++
        }
      }
    }

    items.sort((a, b) => a.date.localeCompare(b.date))
    setPreview(items)

    // Check conflicts
    if (effectivePlan && items.length > 0) {
      setCheckingConflicts(true)
      const dates = [...new Set(items.map(i => i.date))]
      const { data: existing } = await supabase
        .from('appointments')
        .select('appointment_date, appointment_time, patient:patients(full_name)')
        .eq('professional_id', effectivePlan.professional_id)
        .in('appointment_date', dates)
        .neq('status', 'cancelada')

      if (existing && existing.length > 0) {
        const conflictMap = new Map<string, string>()
        for (const appt of existing) {
          const key = `${appt.appointment_date}_${appt.appointment_time?.slice(0, 5)}`
          const name = (appt.patient as any)?.full_name || 'Paciente'
          conflictMap.set(key, name)
        }
        setPreview(prev =>
          prev.map(item => {
            const key = `${item.date}_${item.time}`
            const conflictName = conflictMap.get(key)
            return conflictName ? { ...item, conflict: conflictName } : item
          })
        )
      }
      setCheckingConflicts(false)
    }
  }

  function removeFromPreview(index: number) {
    setPreview(prev => prev.filter((_, i) => i !== index))
  }

  function updatePreviewTime(index: number, time: string) {
    setPreview(prev => prev.map((item, i) => i === index ? { ...item, time } : item))
  }

  async function handleCreate() {
    if (!effectivePlan || !effectivePatientId || preview.length === 0) return

    const today = new Date().toISOString().split('T')[0]
    const pastDates = preview.filter(i => i.date < today)
    if (pastDates.length > 0) {
      toast.error('Remova as datas que já passaram antes de criar.')
      return
    }

    setSaving(true)

    const typeMap: Record<string, string> = {
      treatment: 'tratamento',
      maintenance: 'manutencao',
      avaliacao: 'avaliacao',
    }

    let created = 0
    let errors = 0

    for (const item of preview) {
      const { error } = await supabase.from('appointments').insert({
        patient_id: effectivePatientId,
        professional_id: effectivePlan.professional_id,
        appointment_date: item.date,
        appointment_time: item.time,
        appointment_type: typeMap[effectivePlan.plan_type] || 'tratamento',
        status: 'agendada',
        payment_status: 'pago_pacote',
        payment_method: effectivePlan.payment_method,
        custom_price: 0,
        discount_amount: 0,
        discount_type: 'value',
        final_paid_amount: 0,
        lead_source: effectivePlan.lead_source,
        lead_professional_id: effectivePlan.lead_professional_id,
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

    setSaving(false)

    if (errors > 0) {
      toast.error(`${errors} agendamento(s) com erro (conflito de horário?). ${created} criado(s).`)
    } else {
      toast.success(`${created} agendamento(s) criado(s) com sucesso!`)
    }
    handleClose()
  }

  function handleClose() {
    setScheduleDays({})
    setPreview([])
    setPatientSearch('')
    setSelectedPatientId('')
    setActivePlan(null)
    setPlanPending(0)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={val => !val && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-[95vw] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Agendar Sessões em Lote</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient search (agenda mode) */}
          {showPatientSearch && (
            <div className="space-y-2">
              <Label>Paciente *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar paciente..."
                  value={patientSearch}
                  onChange={e => {
                    setPatientSearch(e.target.value)
                    if (!e.target.value) {
                      setSelectedPatientId('')
                      setActivePlan(null)
                    }
                  }}
                  className="pl-10"
                />
              </div>
              {patientSearch && !selectedPatientId && (
                <div className="max-h-32 overflow-y-auto rounded-md border">
                  {filteredPatients.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => handleSelectPatient(p.id, p.full_name)}
                    >
                      {p.full_name}
                    </button>
                  ))}
                </div>
              )}
              {loadingPlan && (
                <p className="text-xs text-muted-foreground">Buscando plano ativo...</p>
              )}
              {selectedPatientId && !loadingPlan && !activePlan && (
                <p className="text-xs text-red-600">Paciente sem plano ativo.</p>
              )}
            </div>
          )}

          {/* Plan info */}
          {effectivePlan && (
            <div className="rounded-md bg-teal-50 border border-teal-200 px-3 py-2 text-sm text-teal-700">
              <strong>{effectivePlan.plan_name}</strong> — {effectivePending} sessão(ões) pendente(s)
            </div>
          )}

          {effectivePlan && (
            <>
              <p className="text-sm text-muted-foreground">
                Selecione os dias da semana e horários para gerar os agendamentos automaticamente.
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
                        onClick={() => toggleDay(day)}
                      >
                        {DAY_LABELS[day]}
                      </Button>
                    )
                  })}
                </div>
              </div>

              {/* Time per day */}
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
                            <Select value={time} onValueChange={(v: string) => setDayTime(day, v)}>
                              <SelectTrigger className="flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TIME_SLOTS.map(t => (
                                  <SelectItem key={t} value={t}>{t}</SelectItem>
                                ))}
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
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>

              {/* Generate preview */}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={generatePreview}
                disabled={Object.keys(scheduleDays).length === 0}
              >
                Gerar Preview dos Agendamentos
              </Button>

              {/* Preview list */}
              {checkingConflicts && (
                <p className="text-xs text-muted-foreground">Verificando conflitos...</p>
              )}

              {preview.length > 0 && (
                <div className="space-y-2">
                  {preview.some(i => i.conflict) && (
                    <div className="rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-700">
                      ⚠ Alguns horários têm conflito. Você pode manter, remover ou alterar o horário.
                    </div>
                  )}
                  <Label>Preview ({preview.length} agendamentos)</Label>
                  <div className="max-h-60 overflow-y-auto rounded-lg border divide-y">
                    {preview.map((item, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 px-3 py-2 ${item.date < new Date().toISOString().split('T')[0] ? 'bg-red-50' : item.conflict ? 'bg-orange-50' : ''}`}
                      >
                        <span className="text-sm font-medium w-8 text-muted-foreground">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm capitalize">{item.label}</span>
                          {item.date < new Date().toISOString().split('T')[0] && (
                            <p className="text-xs text-red-600">Data passada</p>
                          )}
                          {item.conflict && (
                            <p className="text-xs text-orange-600 truncate">
                              Conflito: {item.conflict}
                            </p>
                          )}
                        </div>
                        <Select value={item.time} onValueChange={(v: string) => updatePreviewTime(i, v)}>
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_SLOTS.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
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
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700"
            onClick={handleCreate}
            disabled={saving || preview.length === 0}
          >
            <CalendarPlus className="mr-2 h-4 w-4" />
            {saving
              ? 'Criando...'
              : `Criar ${preview.length} Agendamento${preview.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

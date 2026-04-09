'use client'

import { useEffect, useState, useCallback } from 'react'
import { format, addDays, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAppointments } from '@/hooks/use-appointments'
import { useProfessionals } from '@/hooks/use-professionals'
import { useUserRole } from '@/hooks/use-user-role'
import { AppointmentFormDialog } from '@/components/appointments/appointment-form-dialog'
import { BatchScheduleDialog } from '@/components/appointments/batch-schedule-dialog'
import { type Appointment } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { APPOINTMENT_STATUSES, SCHEDULE } from '@/lib/constants'
import { cn } from '@/lib/utils'

type ViewMode = 'day' | 'week'

export default function AgendaPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [filterProfId, setFilterProfId] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null)
  const [batchOpen, setBatchOpen] = useState(false)

  const { appointments, fetchAppointments, fetchByRange, loading } = useAppointments()
  const { activeProfessionals } = useProfessionals()
  const { isAdmin, professionalId } = useUserRole()

  const effectiveProfId = isAdmin
    ? filterProfId === 'all' ? undefined : filterProfId
    : professionalId ?? undefined

  const loadAppointments = useCallback(() => {
    if (viewMode === 'day') {
      fetchAppointments(format(currentDate, 'yyyy-MM-dd'), effectiveProfId)
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
      const weekEnd = addDays(weekStart, 6)
      fetchByRange(format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'))
    }
  }, [currentDate, viewMode, effectiveProfId, fetchAppointments, fetchByRange])

  useEffect(() => {
    loadAppointments()
  }, [loadAppointments])

  function navigate(direction: number) {
    const days = viewMode === 'day' ? 1 : 7
    setCurrentDate(prev => addDays(prev, direction * days))
  }

  function getTimeSlots() {
    const slots: string[] = []
    for (let h = SCHEDULE.START_HOUR; h < SCHEDULE.END_HOUR; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`)
    }
    return slots
  }

  function getDaysToShow(): Date[] {
    if (viewMode === 'day') return [currentDate]
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  }

  function getAppointmentsForSlot(date: Date, time: string): Appointment[] {
    const dateStr = format(date, 'yyyy-MM-dd')
    return appointments.filter(a => {
      const matchDate = a.appointment_date === dateStr
      const matchTime = a.appointment_time?.startsWith(time.slice(0, 2))
      const matchProf = !effectiveProfId || a.professional_id === effectiveProfId
      return matchDate && matchTime && matchProf
    })
  }

  function getStatusColor(status: string) {
    const s = APPOINTMENT_STATUSES.find(st => st.value === status)
    if (!s) return 'secondary'
    const map: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      blue: 'default',
      green: 'default',
      red: 'destructive',
      gray: 'secondary',
    }
    return map[s.color] ?? 'secondary'
  }

  function handleSlotClick(date: Date, time: string) {
    setSelectedAppointment(null)
    setSelectedSlot({ date: format(date, 'yyyy-MM-dd'), time })
    setDialogOpen(true)
  }

  function handleAppointmentClick(appt: Appointment) {
    setSelectedSlot(null)
    setSelectedAppointment(appt)
    setDialogOpen(true)
  }

  function handleDialogClose() {
    setDialogOpen(false)
    setSelectedAppointment(null)
    setSelectedSlot(null)
    loadAppointments()
  }

  const days = getDaysToShow()
  const timeSlots = getTimeSlots()

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold">Agenda</h1>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
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
          )}
          <Select value={viewMode} onValueChange={(value: string) => setViewMode(value as ViewMode)}>
            <SelectTrigger className="w-24 sm:w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Dia</SelectItem>
              <SelectItem value="week">Semana</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700"
            onClick={() => {
              setSelectedAppointment(null)
              setSelectedSlot({ date: format(currentDate, 'yyyy-MM-dd'), time: '08:00' })
              setDialogOpen(true)
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Novo
          </Button>
        </div>
      </div>

      <div className="text-sm font-medium text-muted-foreground">
        {viewMode === 'day'
          ? format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
          : `${format(days[0], "d 'de' MMM", { locale: ptBR })} - ${format(days[6], "d 'de' MMM 'de' yyyy", { locale: ptBR })}`}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-auto">
          <div className="min-w-[600px]">
            {/* Header */}
            <div className="grid border-b" style={{ gridTemplateColumns: `80px repeat(${days.length}, 1fr)` }}>
              <div className="p-2 text-xs font-medium text-muted-foreground">Hora</div>
              {days.map(day => (
                <div key={day.toISOString()} className="border-l p-2 text-center text-xs font-medium">
                  {format(day, viewMode === 'day' ? 'EEEE' : 'EEE d', { locale: ptBR })}
                </div>
              ))}
            </div>
            {/* Slots */}
            {timeSlots.map(time => (
              <div
                key={time}
                className="grid border-b"
                style={{ gridTemplateColumns: `80px repeat(${days.length}, 1fr)` }}
              >
                <div className="p-2 text-xs text-muted-foreground">{time}</div>
                {days.map(day => {
                  const slotAppts = getAppointmentsForSlot(day, time)
                  return (
                    <div
                      key={day.toISOString() + time}
                      className="min-h-[48px] cursor-pointer border-l p-1 transition-colors hover:bg-accent"
                      onClick={() => handleSlotClick(day, time)}
                    >
                      {slotAppts.map(appt => (
                        <Card
                          key={appt.id}
                          className={cn(
                            'mb-1 cursor-pointer p-1.5 text-xs transition-colors hover:ring-1 hover:ring-teal-400'
                          )}
                          onClick={e => {
                            e.stopPropagation()
                            handleAppointmentClick(appt)
                          }}
                        >
                          <div className="font-medium truncate">
                            {appt.patient?.full_name ?? 'Paciente'}
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant={getStatusColor(appt.status)} className="text-[10px] px-1 py-0">
                              {APPOINTMENT_STATUSES.find(s => s.value === appt.status)?.label}
                            </Badge>
                            {viewMode === 'week' && appt.professional?.full_name && (
                              <span className="truncate text-muted-foreground">
                                {appt.professional.full_name.split(' ')[0]}
                              </span>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <AppointmentFormDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        appointment={selectedAppointment}
        defaultDate={selectedSlot?.date}
        defaultTime={selectedSlot?.time}
        onSwitchToBatch={() => {
          setDialogOpen(false)
          setBatchOpen(true)
        }}
      />

      <BatchScheduleDialog
        open={batchOpen}
        onClose={() => {
          setBatchOpen(false)
          loadAppointments()
        }}
        showPatientSearch
      />
    </div>
  )
}

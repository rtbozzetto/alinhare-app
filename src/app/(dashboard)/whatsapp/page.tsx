'use client'

import { useEffect, useState, useMemo } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAppointments } from '@/hooks/use-appointments'
import { useProfessionals } from '@/hooks/use-professionals'
import { AdminGuard } from '@/components/layout/admin-guard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ChevronLeft, ChevronRight, Copy, MessageCircle, Send, Eye, EyeOff } from 'lucide-react'
import { formatWhatsAppMessage, getWhatsAppUrl } from '@/lib/utils'
import { APPOINTMENT_STATUSES } from '@/lib/constants'
import { toast } from 'sonner'

export default function WhatsAppPage() {
  return (
    <AdminGuard>
      <WhatsAppContent />
    </AdminGuard>
  )
}

function WhatsAppContent() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const { appointments, fetchAppointments, loading } = useAppointments()
  const { professionals } = useProfessionals()
  const [editingMessages, setEditingMessages] = useState<Record<string, string>>({})
  const [showPreview, setShowPreview] = useState<Record<string, boolean>>({})

  const dateStr = format(currentDate, 'yyyy-MM-dd')
  const dateFormatted = format(currentDate, 'dd/MM/yyyy')

  useEffect(() => {
    fetchAppointments(dateStr)
  }, [dateStr, fetchAppointments])

  useEffect(() => {
    // Reset edited messages when date changes
    setEditingMessages({})
    setShowPreview({})
  }, [dateStr])

  const groupedByProfessional = useMemo(() => {
    const groups: Record<string, typeof appointments> = {}
    for (const appt of appointments) {
      const profId = appt.professional_id
      if (!groups[profId]) groups[profId] = []
      groups[profId].push(appt)
    }
    return groups
  }, [appointments])

  function getProfName(profId: string) {
    return professionals.find(p => p.id === profId)?.full_name ?? 'Profissional'
  }

  function getProfPhone(profId: string) {
    return professionals.find(p => p.id === profId)?.phone ?? ''
  }

  function getDefaultMessage(appt: typeof appointments[0]) {
    const patientName = appt.patient?.full_name ?? 'Paciente'
    const time = appt.appointment_time?.slice(0, 5) ?? ''
    const profName = getProfName(appt.professional_id)
    return formatWhatsAppMessage(patientName, dateFormatted, time, profName)
  }

  function getMessage(apptId: string, appt: typeof appointments[0]) {
    return editingMessages[apptId] ?? getDefaultMessage(appt)
  }

  function handleSendWhatsApp(appt: typeof appointments[0]) {
    const phone = (appt as any).patient?.phone || ''
    if (!phone) {
      toast.error('Paciente sem telefone cadastrado.')
      return
    }
    const message = getMessage(appt.id, appt)
    window.open(getWhatsAppUrl(phone, message), '_blank')
  }

  function handleCopyMessage(appt: typeof appointments[0]) {
    const message = getMessage(appt.id, appt)
    navigator.clipboard.writeText(message)
    toast.success('Mensagem copiada!')
  }

  function buildProfessionalSummary(profId: string) {
    const profAppts = groupedByProfessional[profId] || []
    const profName = getProfName(profId)
    const tomorrowDate = format(addDays(currentDate, 0), 'dd/MM/yyyy')
    const dayName = format(currentDate, 'EEEE', { locale: ptBR })

    let summary = `Olá, ${profName.split(' ')[0]}! Segue o resumo da sua agenda de ${dayName} (${tomorrowDate}):\n\n`

    const sorted = [...profAppts].sort((a, b) =>
      (a.appointment_time ?? '').localeCompare(b.appointment_time ?? '')
    )

    sorted.forEach((appt, i) => {
      const time = appt.appointment_time?.slice(0, 5) ?? ''
      const name = appt.patient?.full_name ?? 'Paciente'
      const status = APPOINTMENT_STATUSES.find(s => s.value === appt.status)?.label ?? ''
      summary += `${i + 1}. ${time} - ${name} (${status})\n`
    })

    summary += `\nTotal: ${sorted.length} atendimento${sorted.length !== 1 ? 's' : ''}.`
    return summary
  }

  function handleSendProfSummary(profId: string) {
    const phone = getProfPhone(profId)
    if (!phone) {
      toast.error('Profissional sem telefone cadastrado.')
      return
    }
    const summary = buildProfessionalSummary(profId)
    window.open(getWhatsAppUrl(phone, summary), '_blank')
  }

  function handleCopyProfSummary(profId: string) {
    const summary = buildProfessionalSummary(profId)
    navigator.clipboard.writeText(summary)
    toast.success('Resumo copiado!')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">WhatsApp</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(prev => subDays(prev, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(prev => addDays(prev, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="text-sm font-medium capitalize text-muted-foreground">
        {format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      ) : appointments.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          Nenhum agendamento para esta data.
        </div>
      ) : (
        Object.entries(groupedByProfessional).map(([profId, profAppointments]) => (
          <Card key={profId}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg">{getProfName(profId)}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyProfSummary(profId)}
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Copiar resumo
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleSendProfSummary(profId)}
                  >
                    <Send className="mr-1 h-3 w-3" />
                    Enviar resumo
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {profAppointments.map(appt => {
                const patientName = appt.patient?.full_name ?? 'Paciente'
                const time = appt.appointment_time?.slice(0, 5) ?? ''
                const statusLabel = APPOINTMENT_STATUSES.find(s => s.value === appt.status)?.label ?? appt.status
                const isEditing = showPreview[appt.id]

                return (
                  <div
                    key={appt.id}
                    className="rounded-lg border p-3 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <p className="font-medium">{patientName}</p>
                        <p className="text-sm text-muted-foreground">
                          {time} - <Badge variant="secondary">{statusLabel}</Badge>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowPreview(prev => ({ ...prev, [appt.id]: !prev[appt.id] }))}
                          title={isEditing ? 'Esconder mensagem' : 'Ver/editar mensagem'}
                        >
                          {isEditing ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyMessage(appt)}
                        >
                          <Copy className="mr-1 h-3 w-3" />
                          Copiar
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleSendWhatsApp(appt)}
                        >
                          <MessageCircle className="mr-1 h-3 w-3" />
                          Enviar
                        </Button>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="space-y-1">
                        <Textarea
                          value={getMessage(appt.id, appt)}
                          onChange={e => setEditingMessages(prev => ({ ...prev, [appt.id]: e.target.value }))}
                          rows={4}
                          className="text-sm"
                        />
                        {editingMessages[appt.id] && (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setEditingMessages(prev => {
                              const next = { ...prev }
                              delete next[appt.id]
                              return next
                            })}
                          >
                            Restaurar mensagem padrão
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

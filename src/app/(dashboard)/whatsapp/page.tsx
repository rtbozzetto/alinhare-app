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
import { ChevronLeft, ChevronRight, Copy, MessageCircle } from 'lucide-react'
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

  const dateStr = format(currentDate, 'yyyy-MM-dd')

  useEffect(() => {
    fetchAppointments(dateStr)
  }, [dateStr, fetchAppointments])

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

  function handleSendWhatsApp(patientName: string, phone: string, time: string, profName: string) {
    const dateFormatted = format(currentDate, "dd/MM/yyyy")
    const message = formatWhatsAppMessage(patientName, dateFormatted, time, profName)
    const url = getWhatsAppUrl(phone, message)
    window.open(url, '_blank')
  }

  function handleCopyMessage(patientName: string, time: string, profName: string) {
    const dateFormatted = format(currentDate, "dd/MM/yyyy")
    const message = formatWhatsAppMessage(patientName, dateFormatted, time, profName)
    navigator.clipboard.writeText(message)
    toast.success('Mensagem copiada!')
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
              <CardTitle className="text-lg">{getProfName(profId)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profAppointments.map(appt => {
                const patientName = appt.patient?.full_name ?? 'Paciente'
                const profName = getProfName(profId)
                const time = appt.appointment_time?.slice(0, 5) ?? ''
                const statusLabel = APPOINTMENT_STATUSES.find(s => s.value === appt.status)?.label ?? appt.status

                return (
                  <div
                    key={appt.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div className="space-y-0.5">
                      <p className="font-medium">{patientName}</p>
                      <p className="text-sm text-muted-foreground">
                        {time} - <Badge variant="secondary">{statusLabel}</Badge>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyMessage(patientName, time, profName)}
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        Copiar
                      </Button>
                      {appt.patient?.full_name && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          disabled={!appt.patient?.full_name}
                          onClick={() => {
                            const phone = (appt as any).patient?.phone || ''
                            if (phone) {
                              handleSendWhatsApp(patientName, phone, time, profName)
                            } else {
                              toast.error('Paciente sem telefone cadastrado.')
                            }
                          }}
                        >
                          <MessageCircle className="mr-1 h-3 w-3" />
                          Enviar
                        </Button>
                      )}
                    </div>
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

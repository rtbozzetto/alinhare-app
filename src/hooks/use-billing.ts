'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type MonthlyClosing, type Appointment, type TreatmentPlan } from '@/types/database'

export interface BillingPlanRow {
  id: string
  created_at: string
  patient_name: string
  professional_name: string
  professional_id: string
  plan_name: string
  plan_type: string
  price: number
  discount_amount: number
  final_paid_amount: number
  payment_status: string
  commission_amount: number
  clinic_amount: number
  lead_source: string
}

export interface BillingSessionRow {
  id: string
  session_date: string
  session_number: number
  total_sessions: number
  patient_name: string
  professional_name: string
  professional_id: string
  plan_name: string
  plan_type: string
  price: number
  discount_amount: number
  final_paid_amount: number
  payment_status: string
  commission_amount: number
  clinic_amount: number
  lead_source: string
}

export function useBilling() {
  const [closings, setClosings] = useState<MonthlyClosing[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [paidPlans, setPaidPlans] = useState<BillingPlanRow[]>([])
  const [completedSessions, setCompletedSessions] = useState<BillingSessionRow[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetchClosings = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('monthly_closings')
      .select('*')
      .order('reference_month', { ascending: false })
    if (data) setClosings(data)
    setLoading(false)
  }, [supabase])

  const fetchAppointmentsByMonth = useCallback(async (year: number, month: number) => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0).toISOString().split('T')[0] // last day
    const { data } = await supabase
      .from('appointments')
      .select('*, patient:patients(full_name), professional:professionals!professional_id(id, full_name)')
      .gte('appointment_date', startDate)
      .lte('appointment_date', endDate)
      .order('appointment_date')
    if (data) {
      // Enrich appointments with plan info (plan_name + session number)
      const patientIds = [...new Set(data.map((a: any) => a.patient_id))]
      const { data: plans } = await supabase
        .from('treatment_plans')
        .select('id, patient_id, professional_id, plan_name, plan_type, total_sessions')
        .in('patient_id', patientIds.length > 0 ? patientIds : ['__none__'])

      const typeMap: Record<string, string> = { treatment: 'tratamento', maintenance: 'manutencao', avaliacao: 'avaliacao' }

      // For each patient+professional+type combo, count appointments in order to determine session number
      const apptsByKey: Record<string, any[]> = {}
      const sorted = [...data].sort((a: any, b: any) => a.appointment_date.localeCompare(b.appointment_date) || (a.appointment_time ?? '').localeCompare(b.appointment_time ?? ''))
      for (const appt of sorted) {
        const key = `${appt.patient_id}_${appt.professional_id}_${appt.appointment_type}`
        if (!apptsByKey[key]) apptsByKey[key] = []
        apptsByKey[key].push(appt)
      }

      const enriched = data.map((appt: any) => {
        const matchingPlan = plans?.find((p: any) =>
          p.patient_id === appt.patient_id &&
          p.professional_id === appt.professional_id &&
          typeMap[p.plan_type] === appt.appointment_type
        )
        if (matchingPlan) {
          const key = `${appt.patient_id}_${appt.professional_id}_${appt.appointment_type}`
          const idx = apptsByKey[key]?.findIndex((a: any) => a.id === appt.id) ?? -1
          return {
            ...appt,
            _plan_name: matchingPlan.plan_name,
            _session_number: idx + 1,
            _total_sessions: matchingPlan.total_sessions,
          }
        }
        return appt
      })
      setAppointments(enriched as Appointment[])
    }

    // Also fetch paid treatment plans created in this month
    const { data: plans } = await supabase
      .from('treatment_plans')
      .select('*, patient:patients(full_name), professional:professionals!professional_id(id, full_name)')
      .in('payment_status', ['pago', 'pago_pacote'])
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at')
    if (plans) {
      setPaidPlans(plans.map((p: any) => ({
        id: p.id,
        created_at: p.created_at,
        patient_name: p.patient?.full_name ?? '-',
        professional_name: p.professional?.full_name ?? '-',
        professional_id: p.professional_id,
        plan_name: p.plan_name,
        plan_type: p.plan_type,
        price: p.price,
        discount_amount: p.discount_amount,
        final_paid_amount: p.final_paid_amount,
        payment_status: p.payment_status,
        commission_amount: p.commission_amount,
        clinic_amount: p.clinic_amount,
        lead_source: p.lead_source,
      })))
    }

    // Fetch completed sessions in this month that DON'T have a matching appointment
    // These are sessions marked as done directly without scheduling
    const { data: sessionsData } = await supabase
      .from('treatment_sessions')
      .select('*, plan:treatment_plans(*, patient:patients(full_name), professional:professionals!professional_id(id, full_name))')
      .eq('completed', true)
      .gte('session_date', startDate)
      .lte('session_date', endDate)
      .order('session_date')

    if (sessionsData && data) {
      // Get appointment session_ids to exclude sessions that already have appointments
      const appointmentSessionIds = new Set(
        data.filter((a: any) => a.session_id).map((a: any) => a.session_id)
      )
      // Also exclude sessions from plans already shown as paid plan rows
      const paidPlanIds = new Set(
        (plans || []).map((p: any) => p.id)
      )

      const sessionsWithoutAppt = sessionsData.filter((s: any) =>
        !appointmentSessionIds.has(s.id) &&
        !paidPlanIds.has(s.plan_id) &&
        s.plan
      )

      setCompletedSessions(sessionsWithoutAppt.map((s: any) => {
        const plan = s.plan
        const totalSessions = plan.total_sessions || 1
        const perSessionPrice = plan.price / totalSessions
        const perSessionDiscount = plan.discount_amount / totalSessions
        const perSessionFinal = plan.final_paid_amount / totalSessions
        const perSessionCommission = plan.commission_amount / totalSessions
        const perSessionClinic = plan.clinic_amount / totalSessions

        return {
          id: s.id,
          session_date: s.session_date,
          session_number: s.session_number,
          total_sessions: totalSessions,
          patient_name: plan.patient?.full_name ?? '-',
          professional_name: plan.professional?.full_name ?? '-',
          professional_id: plan.professional_id,
          plan_name: plan.plan_name,
          plan_type: plan.plan_type,
          price: Math.round(perSessionPrice * 100) / 100,
          discount_amount: Math.round(perSessionDiscount * 100) / 100,
          final_paid_amount: Math.round(perSessionFinal * 100) / 100,
          payment_status: plan.payment_status,
          commission_amount: Math.round(perSessionCommission * 100) / 100,
          clinic_amount: Math.round(perSessionClinic * 100) / 100,
          lead_source: plan.lead_source,
        }
      }))
    } else {
      setCompletedSessions([])
    }
  }, [supabase])

  const closeMonth = async (
    referenceMonth: string,
    totals: Omit<MonthlyClosing, 'id' | 'reference_month' | 'status' | 'created_at' | 'updated_at' | 'reopened_at' | 'closed_at'>
  ) => {
    const { data, error } = await supabase
      .from('monthly_closings')
      .upsert(
        {
          reference_month: referenceMonth,
          status: 'fechado',
          closed_at: new Date().toISOString(),
          ...totals,
        },
        { onConflict: 'reference_month' }
      )
      .select()
      .single()
    if (!error && data) {
      setClosings(prev => {
        const existing = prev.findIndex(c => c.reference_month === referenceMonth)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = data
          return updated
        }
        return [data, ...prev]
      })
    }
    return { data, error }
  }

  const reopenMonth = async (referenceMonth: string) => {
    const { data, error } = await supabase
      .from('monthly_closings')
      .update({
        status: 'aberto',
        reopened_at: new Date().toISOString(),
      })
      .eq('reference_month', referenceMonth)
      .select()
      .single()
    if (!error && data) {
      setClosings(prev => prev.map(c => c.reference_month === referenceMonth ? data : c))
    }
    return { data, error }
  }

  const deleteAppointment = async (id: string) => {
    const { error } = await supabase.from('appointments').delete().eq('id', id)
    if (!error) {
      setAppointments(prev => prev.filter(a => a.id !== id))
    }
    return { error }
  }

  return {
    closings,
    appointments,
    paidPlans,
    completedSessions,
    loading,
    fetchClosings,
    fetchAppointmentsByMonth,
    closeMonth,
    reopenMonth,
    deleteAppointment,
  }
}

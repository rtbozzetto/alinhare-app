'use client'
import { useState, useCallback, useMemo } from 'react'
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
  const supabase = useMemo(() => createClient(), [])

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
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
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

    // Fetch ALL completed sessions, then filter client-side by month
    // This avoids TIMESTAMPTZ vs DATE comparison issues in PostgREST filters
    const { data: sessionsData } = await supabase
      .from('treatment_sessions')
      .select('*, plan:treatment_plans(*, patient:patients(full_name), professional:professionals!professional_id(id, full_name))')
      .eq('completed', true)
      .order('updated_at')

    if (sessionsData && data) {
      // Filter sessions that belong to this month (by session_date or updated_at)
      const sessionsInMonth = sessionsData.filter((s: any) => {
        const sessionDate = s.session_date?.split('T')[0] ?? null
        const updatedDate = s.updated_at?.split('T')[0] ?? null
        return (sessionDate && sessionDate >= startDate && sessionDate <= endDate) ||
               (updatedDate && updatedDate >= startDate && updatedDate <= endDate)
      })

      // All completed sessions in month appear in the sessions section
      const allCompletedInMonth = sessionsInMonth.filter((s: any) => s.plan)

      // Build set of completed session keys to remove matching appointments (avoid duplication)
      const completedSessionKeys = new Set(
        allCompletedInMonth
          .map((s: any) => {
            const d = s.session_date?.split('T')[0] ?? null
            return d ? `${s.patient_id}_${s.professional_id}_${d}` : null
          })
          .filter(Boolean)
      )
      // Remove appointments that are covered by a completed session
      setAppointments((prev: Appointment[]) =>
        prev.filter((a: any) => {
          const key = `${a.patient_id}_${a.professional_id}_${a.appointment_date}`
          return !completedSessionKeys.has(key)
        })
      )

      // Plans already shown as paid plan rows — sessions from these show without value
      const paidPlanIds = new Set(
        (plans || []).map((p: any) => p.id)
      )

      setCompletedSessions(allCompletedInMonth.map((s: any) => {
        const plan = s.plan
        const totalSessions = plan.total_sessions > 0 ? plan.total_sessions : 1
        // Show value only if plan is NOT already shown as a paid plan row
        const hasValue = !paidPlanIds.has(s.plan_id)
        const perSessionPrice = hasValue ? plan.price / totalSessions : 0
        const perSessionDiscount = hasValue ? (plan.discount_amount ?? 0) / totalSessions : 0
        const perSessionFinal = hasValue ? (plan.final_paid_amount ?? 0) / totalSessions : 0
        const perSessionCommission = hasValue ? (plan.commission_amount ?? 0) / totalSessions : 0
        const perSessionClinic = hasValue ? (plan.clinic_amount ?? 0) / totalSessions : 0

        return {
          id: s.id,
          session_date: s.session_date?.split('T')[0] ?? s.updated_at.split('T')[0],
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
          payment_status: paidPlanIds.has(s.plan_id) ? 'pago_pacote' : plan.payment_status,
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

'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type MonthlyClosing, type Appointment } from '@/types/database'

export function useBilling() {
  const [closings, setClosings] = useState<MonthlyClosing[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
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
      .select('*, patient:patients(full_name), professional:professionals(id, full_name)')
      .gte('appointment_date', startDate)
      .lte('appointment_date', endDate)
      .order('appointment_date')
    if (data) setAppointments(data as Appointment[])
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

  return {
    closings,
    appointments,
    loading,
    fetchClosings,
    fetchAppointmentsByMonth,
    closeMonth,
    reopenMonth,
  }
}

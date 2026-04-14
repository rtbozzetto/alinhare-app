'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Appointment } from '@/types/database'

export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetchAppointments = useCallback(async (date?: string, professionalId?: string) => {
    setLoading(true)
    let query = supabase
      .from('appointments')
      .select('*, patient:patients(full_name, phone), professional:professionals!professional_id(id, full_name)')
      .order('appointment_date')
      .order('appointment_time')

    if (date) query = query.eq('appointment_date', date)
    if (professionalId) query = query.eq('professional_id', professionalId)

    const { data, error } = await query
    if (error) {
      console.error('fetchAppointments error:', error)
    }
    setAppointments((data as Appointment[]) ?? [])
    setLoading(false)
  }, [supabase])

  const fetchByRange = useCallback(async (startDate: string, endDate: string, professionalId?: string) => {
    setLoading(true)
    let query = supabase
      .from('appointments')
      .select('*, patient:patients(full_name, phone), professional:professionals!professional_id(id, full_name)')
      .gte('appointment_date', startDate)
      .lte('appointment_date', endDate)
      .order('appointment_date')
      .order('appointment_time')
    if (professionalId) query = query.eq('professional_id', professionalId)
    const { data, error } = await query
    if (error) {
      console.error('fetchByRange error:', error)
    }
    setAppointments((data as Appointment[]) ?? [])
    setLoading(false)
  }, [supabase])

  const createAppointment = async (appointment: Partial<Appointment>) => {
    const { data, error } = await supabase
      .from('appointments')
      .insert(appointment)
      .select('*, patient:patients(full_name, phone), professional:professionals!professional_id(id, full_name)')
      .single()
    if (error) {
      console.error('Appointment create error:', error)
      return { data: null, error }
    }
    setAppointments(prev => [...prev, data as Appointment])
    return { data, error: null }
  }

  const updateAppointment = async (id: string, updates: Partial<Appointment>) => {
    const { data, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', id)
      .select('*, patient:patients(full_name, phone), professional:professionals!professional_id(id, full_name)')
      .single()
    if (!error && data) {
      setAppointments(prev => prev.map(a => a.id === id ? data as Appointment : a))
    }
    return { data, error }
  }

  const deleteAppointment = async (id: string) => {
    const { error } = await supabase.from('appointments').delete().eq('id', id)
    if (!error) setAppointments(prev => prev.filter(a => a.id !== id))
    return { error }
  }

  return {
    appointments,
    loading,
    fetchAppointments,
    fetchByRange,
    createAppointment,
    updateAppointment,
    deleteAppointment,
  }
}

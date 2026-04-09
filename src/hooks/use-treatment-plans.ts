'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type TreatmentPlan, type TreatmentSession } from '@/types/database'

export function useTreatmentPlans(patientId?: string) {
  const [plans, setPlans] = useState<TreatmentPlan[]>([])
  const [sessions, setSessions] = useState<TreatmentSession[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetchPlans = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    const { data } = await supabase
      .from('treatment_plans')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
    if (data) setPlans(data)
    setLoading(false)
  }, [supabase, patientId])

  const fetchSessions = useCallback(async (planId?: string) => {
    if (!patientId) return
    let query = supabase
      .from('treatment_sessions')
      .select('*')
      .eq('patient_id', patientId)
      .order('session_number')
    if (planId) query = query.eq('plan_id', planId)
    const { data } = await query
    if (data) setSessions(data)
  }, [supabase, patientId])

  const createPlan = async (plan: Partial<TreatmentPlan>) => {
    const { data, error } = await supabase
      .from('treatment_plans')
      .insert(plan)
      .select()
      .single()
    if (!error && data) {
      setPlans(prev => [data, ...prev])
      // Create sessions automatically
      const sessionsToCreate = Array.from({ length: data.total_sessions }, (_, i) => ({
        plan_id: data.id,
        patient_id: data.patient_id,
        professional_id: data.professional_id,
        session_number: i + 1,
      }))
      await supabase.from('treatment_sessions').insert(sessionsToCreate)
    }
    return { data, error }
  }

  const updatePlan = async (id: string, updates: Partial<TreatmentPlan>) => {
    const { data, error } = await supabase
      .from('treatment_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (!error && data) setPlans(prev => prev.map(p => p.id === id ? data : p))
    return { data, error }
  }

  const deletePlan = async (id: string) => {
    const { error } = await supabase.from('treatment_plans').delete().eq('id', id)
    if (!error) setPlans(prev => prev.filter(p => p.id !== id))
    return { error }
  }

  const updateSession = async (id: string, updates: Partial<TreatmentSession>) => {
    const { data, error } = await supabase
      .from('treatment_sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (!error && data) setSessions(prev => prev.map(s => s.id === id ? data : s))
    return { data, error }
  }

  const deleteSession = async (id: string) => {
    const { error } = await supabase.from('treatment_sessions').delete().eq('id', id)
    if (!error) setSessions(prev => prev.filter(s => s.id !== id))
    return { error }
  }

  return {
    plans,
    sessions,
    loading,
    fetchPlans,
    fetchSessions,
    createPlan,
    updatePlan,
    deletePlan,
    updateSession,
    deleteSession,
  }
}

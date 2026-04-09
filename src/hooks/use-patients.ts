'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Patient } from '@/types/database'
import { useUserRole } from '@/hooks/use-user-role'

export function usePatients() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const { isAdmin, professionalId } = useUserRole()

  const fetchPatients = useCallback(async () => {
    setLoading(true)
    const query = supabase.from('patients').select('*').order('full_name')
    // RLS handles filtering on backend, but we fetch all accessible
    const { data, error } = await query
    if (!error && data) setPatients(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchPatients() }, [fetchPatients])

  const createPatient = async (patient: Omit<Patient, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase.from('patients').insert(patient).select().single()
    if (!error && data) {
      // Auto-link to professional if not admin
      if (professionalId) {
        await supabase.from('professional_patients').insert({
          professional_id: professionalId,
          patient_id: data.id,
        })
      }
      setPatients(prev => [...prev, data].sort((a, b) => a.full_name.localeCompare(b.full_name)))
    }
    return { data, error }
  }

  const updatePatient = async (id: string, updates: Partial<Patient>) => {
    const { data, error } = await supabase.from('patients').update(updates).eq('id', id).select().single()
    if (!error && data) {
      setPatients(prev => prev.map(p => p.id === id ? data : p))
    }
    return { data, error }
  }

  const deletePatient = async (id: string) => {
    const { error } = await supabase.from('patients').delete().eq('id', id)
    if (!error) setPatients(prev => prev.filter(p => p.id !== id))
    return { error }
  }

  const getPatient = async (id: string) => {
    const { data, error } = await supabase.from('patients').select('*').eq('id', id).single()
    return { data, error }
  }

  return { patients, loading, fetchPatients, createPatient, updatePatient, deletePatient, getPatient }
}

'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Professional } from '@/types/database'

export function useProfessionals() {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchProfessionals = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('professionals')
      .select('*')
      .order('full_name')
    if (!error && data) setProfessionals(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchProfessionals() }, [fetchProfessionals])

  const activeProfessionals = professionals.filter(p => p.active)

  const createProfessional = async (professional: Partial<Professional>) => {
    const { data, error } = await supabase
      .from('professionals')
      .insert(professional)
      .select()
      .single()
    if (!error && data) {
      setProfessionals(prev => [...prev, data].sort((a, b) => a.full_name.localeCompare(b.full_name)))
    }
    return { data, error }
  }

  const updateProfessional = async (id: string, updates: Partial<Professional>) => {
    const { data, error } = await supabase
      .from('professionals')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (!error && data) {
      setProfessionals(prev => prev.map(p => p.id === id ? data : p))
    }
    return { data, error }
  }

  const deleteProfessional = async (id: string) => {
    const { error } = await supabase.from('professionals').delete().eq('id', id)
    if (!error) setProfessionals(prev => prev.filter(p => p.id !== id))
    return { error }
  }

  const getProfessional = async (id: string) => {
    const { data, error } = await supabase.from('professionals').select('*').eq('id', id).single()
    return { data, error }
  }

  return { professionals, activeProfessionals, loading, fetchProfessionals, createProfessional, updateProfessional, deleteProfessional, getProfessional }
}

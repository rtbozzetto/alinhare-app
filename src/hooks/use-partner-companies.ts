'use client'
import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type PartnerCompany } from '@/types/database'

export function usePartnerCompanies() {
  const [companies, setCompanies] = useState<PartnerCompany[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('partner_companies')
      .select('*')
      .order('name')
    if (!error && data) setCompanies(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchCompanies() }, [fetchCompanies])

  const activeCompanies = companies.filter(c => c.active)

  const createCompany = async (name: string) => {
    const { data, error } = await supabase
      .from('partner_companies')
      .insert({ name: name.trim() })
      .select()
      .single()
    if (!error && data) {
      setCompanies(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    }
    return { data, error }
  }

  const updateCompany = async (id: string, updates: Partial<PartnerCompany>) => {
    const { data, error } = await supabase
      .from('partner_companies')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (!error && data) {
      setCompanies(prev => prev.map(c => c.id === id ? data : c))
    }
    return { data, error }
  }

  const deactivateCompany = async (id: string) => {
    const { error } = await supabase
      .from('partner_companies')
      .update({ active: false })
      .eq('id', id)
    if (!error) {
      setCompanies(prev => prev.map(c => c.id === id ? { ...c, active: false } : c))
    }
    return { error }
  }

  const reactivateCompany = async (id: string) => {
    const { error } = await supabase
      .from('partner_companies')
      .update({ active: true })
      .eq('id', id)
    if (!error) {
      setCompanies(prev => prev.map(c => c.id === id ? { ...c, active: true } : c))
    }
    return { error }
  }

  return {
    companies,
    activeCompanies,
    loading,
    fetchCompanies,
    createCompany,
    updateCompany,
    deactivateCompany,
    reactivateCompany,
  }
}

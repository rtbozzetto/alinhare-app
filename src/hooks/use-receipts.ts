'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Receipt } from '@/types/database'

export function useReceipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetchByPatient = useCallback(async (patientId: string) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('receipts')
      .select('*, patient:patients(full_name), professional:professionals!professional_id(full_name)')
      .eq('patient_id', patientId)
      .order('issued_at', { ascending: false })
    if (!error && data) setReceipts(data as Receipt[])
    setLoading(false)
  }, [supabase])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('receipts')
      .select('*, patient:patients(full_name), professional:professionals!professional_id(full_name)')
      .order('issued_at', { ascending: false })
      .limit(200)
    if (!error && data) setReceipts(data as Receipt[])
    setLoading(false)
  }, [supabase])

  const createReceipt = async (receipt: Omit<Receipt, 'id' | 'created_at' | 'created_by' | 'patient' | 'professional'>) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('receipts')
      .insert({ ...receipt, created_by: user?.id ?? null })
      .select('*, patient:patients(full_name), professional:professionals!professional_id(full_name)')
      .single()
    if (!error && data) {
      setReceipts(prev => [data as Receipt, ...prev])
    }
    return { data: data as Receipt | null, error }
  }

  const deleteReceipt = async (id: string) => {
    const { error } = await supabase.from('receipts').delete().eq('id', id)
    if (!error) setReceipts(prev => prev.filter(r => r.id !== id))
    return { error }
  }

  return {
    receipts,
    loading,
    fetchByPatient,
    fetchAll,
    createReceipt,
    deleteReceipt,
  }
}

'use client'
import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type PriceProtocol } from '@/types/database'

export type ProtocolKey = 'janaina' | 'quiropraxistas'
export type PriceCategory = 'treatment' | 'maintenance' | 'evaluation'

export interface GroupedPriceTable {
  label: string
  evaluation: PriceProtocol[]
  treatment: PriceProtocol[]
  maintenance: PriceProtocol[]
}

export type GroupedPriceTables = Record<ProtocolKey, GroupedPriceTable>

export function usePriceTables() {
  const [prices, setPrices] = useState<PriceProtocol[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchPrices = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('price_protocols')
      .select('*')
      .eq('active', true)
      .order('sort_order')
    if (!error && data) setPrices(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchPrices() }, [fetchPrices])

  // Agrupa no formato que o treatment-plans-tab espera
  const grouped: GroupedPriceTables = {
    janaina: { label: 'Protocolo Janaína', evaluation: [], treatment: [], maintenance: [] },
    quiropraxistas: { label: 'Protocolo Quiropraxistas', evaluation: [], treatment: [], maintenance: [] },
  }
  for (const p of prices) {
    if (grouped[p.protocol_key]) {
      grouped[p.protocol_key].label = p.protocol_label
      grouped[p.protocol_key][p.category].push(p)
    }
  }

  // Helper: busca preço de avaliação por protocolo
  const getEvaluationPrice = (protocol: ProtocolKey): number => {
    const eval_ = grouped[protocol]?.evaluation[0]
    return eval_?.price ?? 0
  }

  // Helper: busca opções de plano por protocolo e tipo
  const getPlanOptions = (protocol: ProtocolKey, category: 'treatment' | 'maintenance'): PriceProtocol[] => {
    return grouped[protocol]?.[category] ?? []
  }

  // CRUD admin
  const updatePrice = async (id: string, updates: Partial<PriceProtocol>) => {
    const { data, error } = await supabase
      .from('price_protocols')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (!error && data) {
      setPrices(prev => prev.map(p => p.id === id ? data : p))
    }
    return { data, error }
  }

  const createPrice = async (price: Omit<PriceProtocol, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('price_protocols')
      .insert(price)
      .select()
      .single()
    if (!error && data) {
      setPrices(prev => [...prev, data].sort((a, b) => a.sort_order - b.sort_order))
    }
    return { data, error }
  }

  const deletePrice = async (id: string) => {
    // Soft delete: desativa
    const { error } = await supabase
      .from('price_protocols')
      .update({ active: false })
      .eq('id', id)
    if (!error) {
      setPrices(prev => prev.filter(p => p.id !== id))
    }
    return { error }
  }

  return {
    prices,
    grouped,
    loading,
    fetchPrices,
    getEvaluationPrice,
    getPlanOptions,
    updatePrice,
    createPrice,
    deletePrice,
  }
}

'use client'
import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type ClinicSettings } from '@/types/database'

export function useClinicSettings() {
  const [settings, setSettings] = useState<ClinicSettings | null>(null)
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('clinic_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!error) setSettings(data)

    // Also fetch signature as data URL for use in PDF
    if (data?.signature_url) {
      const { data: signed } = await supabase.storage
        .from('signatures')
        .createSignedUrl(data.signature_url, 3600)
      if (signed?.signedUrl) {
        try {
          const res = await fetch(signed.signedUrl)
          const blob = await res.blob()
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
          setSignatureDataUrl(dataUrl)
        } catch (err) {
          console.error('Failed to fetch signature:', err)
        }
      }
    } else {
      setSignatureDataUrl(null)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const updateSettings = async (updates: Partial<ClinicSettings>) => {
    if (!settings?.id) return { error: new Error('Settings não carregado') }
    const { data, error } = await supabase
      .from('clinic_settings')
      .update(updates)
      .eq('id', settings.id)
      .select()
      .single()
    if (!error && data) setSettings(data)
    return { data, error }
  }

  const uploadSignature = async (file: File) => {
    const ext = file.name.split('.').pop() || 'png'
    const filePath = `signature-${Date.now()}.${ext}`

    // Delete old signature if exists
    if (settings?.signature_url) {
      await supabase.storage.from('signatures').remove([settings.signature_url])
    }

    const { error: uploadError } = await supabase.storage
      .from('signatures')
      .upload(filePath, file, { upsert: true })
    if (uploadError) return { error: uploadError }

    const { error: updateErr } = await updateSettings({ signature_url: filePath })
    if (!updateErr) await fetchSettings()
    return { error: updateErr }
  }

  const removeSignature = async () => {
    if (settings?.signature_url) {
      await supabase.storage.from('signatures').remove([settings.signature_url])
    }
    const { error } = await updateSettings({ signature_url: null })
    if (!error) setSignatureDataUrl(null)
    return { error }
  }

  return {
    settings,
    signatureDataUrl,
    loading,
    fetchSettings,
    updateSettings,
    uploadSignature,
    removeSignature,
  }
}

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

    // Fetch signature as data URL for use in PDF
    // Priority: user-uploaded signature > default bundled signature
    const fetchAsDataUrl = async (url: string): Promise<string | null> => {
      try {
        const res = await fetch(url)
        const blob = await res.blob()
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
      } catch (err) {
        console.error('Failed to load signature:', err)
        return null
      }
    }

    if (data?.signature_url) {
      const { data: signed } = await supabase.storage
        .from('signatures')
        .createSignedUrl(data.signature_url, 3600)
      if (signed?.signedUrl) {
        const url = await fetchAsDataUrl(signed.signedUrl)
        setSignatureDataUrl(url)
      } else {
        setSignatureDataUrl(null)
      }
    } else {
      // Fallback: bundled default signature (Janaína)
      const url = await fetchAsDataUrl('/default-signature.png')
      setSignatureDataUrl(url)
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

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useTreatmentPlans } from '@/hooks/use-treatment-plans'
import { createClient } from '@/lib/supabase/client'
import { type TreatmentSession, type DiscomfortRecord, type ClinicalNote, type PatientPhoto, type PostureAnalysis } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { BODY_REGIONS, PHOTO_TYPES } from '@/lib/constants'
import { toast } from 'sonner'
import { Check, Eye, Plus, Trash2, Camera, Brain, Loader2, AlertTriangle, X, Upload, PartyPopper } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SessionsTabProps {
  patientId: string
  onRequestNewPlan?: () => void
}

const PHOTO_TYPE_LABELS: Record<string, string> = {
  frente: 'Frente',
  costas: 'Costas',
  lateral_direita: 'Lateral D',
  lateral_esquerda: 'Lateral E',
}

export function SessionsTab({ patientId, onRequestNewPlan }: SessionsTabProps) {
  const { plans, sessions, loading, fetchPlans, fetchSessions, updateSession } =
    useTreatmentPlans(patientId)
  const supabase = createClient()

  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<TreatmentSession | null>(null)
  const [sessionNotes, setSessionNotes] = useState('')
  const [discomfortRecords, setDiscomfortRecords] = useState<DiscomfortRecord[]>([])
  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNote[]>([])

  // Discomfort toggle map: region -> intensity
  const [selectedRegions, setSelectedRegions] = useState<Record<string, number>>({})
  const [customDiscomfort, setCustomDiscomfort] = useState('')
  const [savingDiscomforts, setSavingDiscomforts] = useState(false)

  // New clinical note form
  const [newClinicalNote, setNewClinicalNote] = useState('')

  const [saving, setSaving] = useState(false)
  const [celebrationDismissed, setCelebrationDismissed] = useState<Set<string>>(new Set())

  // Photo states
  const [sessionPhotos, setSessionPhotos] = useState<PatientPhoto[]>([])
  const [uploadingType, setUploadingType] = useState<string | null>(null)
  const [validatingType, setValidatingType] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<{ type: string; message: string; issues: string[] } | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const cameraInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // AI Analysis states
  const [analyzing, setAnalyzing] = useState(false)
  const [currentAnalysis, setCurrentAnalysis] = useState<PostureAnalysis | null>(null)

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  useEffect(() => {
    if (plans.length > 0) {
      fetchSessions()
    }
  }, [plans, fetchSessions])

  const loadSessionDetails = useCallback(async (session: TreatmentSession) => {
    // Load discomfort records for this session
    const { data: discomforts } = await supabase
      .from('discomfort_records')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at')

    // Build region -> intensity map
    const regionMap: Record<string, number> = {}

    if (discomforts && discomforts.length > 0) {
      // Session already has its own records
      setDiscomfortRecords(discomforts)
      for (const d of discomforts) {
        regionMap[d.body_region] = d.pain_intensity
      }
    } else {
      // Pre-fill from previous session or patient initial data
      const allSessions = sessions
        .filter(s => s.plan_id === session.plan_id && s.session_number < session.session_number)
        .sort((a, b) => b.session_number - a.session_number)

      let prefilled = false
      for (const prevSession of allSessions) {
        const { data: prevDiscomforts } = await supabase
          .from('discomfort_records')
          .select('*')
          .eq('session_id', prevSession.id)
          .order('created_at')
        if (prevDiscomforts && prevDiscomforts.length > 0) {
          setDiscomfortRecords([])
          for (const d of prevDiscomforts) {
            regionMap[d.body_region] = d.pain_intensity
          }
          prefilled = true
          break
        }
      }

      if (!prefilled) {
        const { data: patient } = await supabase
          .from('patients')
          .select('discomfort_regions, discomfort_intensities')
          .eq('id', patientId)
          .single()
        if (patient?.discomfort_regions?.length) {
          for (const region of patient.discomfort_regions as string[]) {
            regionMap[region] = patient.discomfort_intensities?.[region] ?? 5
          }
        }
        setDiscomfortRecords([])
      }
    }
    setSelectedRegions(regionMap)

    // Load clinical notes
    const { data: notes } = await supabase
      .from('clinical_notes')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at')
    if (notes) setClinicalNotes(notes)

    // Load session photos
    const { data: photos } = await supabase
      .from('patient_photos')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at')
    if (photos) {
      const photosWithUrls = await Promise.all(
        photos.map(async (photo) => {
          const { data: signedData } = await supabase.storage
            .from('patient-photos')
            .createSignedUrl(photo.photo_url, 3600)
          return { ...photo, photo_url: signedData?.signedUrl ?? photo.photo_url }
        })
      )
      setSessionPhotos(photosWithUrls)
    } else {
      setSessionPhotos([])
    }

    // Load existing analysis for this session
    const { data: analysis } = await supabase
      .from('posture_analyses')
      .select('*')
      .eq('session_a_id', session.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setCurrentAnalysis(analysis)
  }, [supabase])

  function openDetail(session: TreatmentSession) {
    setSelectedSession(session)
    setSessionNotes(session.notes ?? '')
    setDiscomfortRecords([])
    setClinicalNotes([])
    setSessionPhotos([])
    setCurrentAnalysis(null)
    setValidationError(null)
    setSelectedRegions({})
    setCustomDiscomfort('')
    setNewClinicalNote('')
    loadSessionDetails(session)
    setDetailOpen(true)
  }

  async function handleToggleCompleted(session: TreatmentSession) {
    const { error } = await updateSession(session.id, { completed: !session.completed })
    if (error) {
      toast.error('Erro ao atualizar sessao.')
    }
  }

  async function handleSaveSessionNotes() {
    if (!selectedSession) return
    setSaving(true)
    const { error } = await updateSession(selectedSession.id, { notes: sessionNotes })
    setSaving(false)
    if (error) {
      toast.error('Erro ao salvar observacoes.')
    } else {
      toast.success('Observacoes salvas!')
    }
  }

  function toggleRegion(region: string) {
    setSelectedRegions(prev => {
      const next = { ...prev }
      if (next[region] !== undefined) {
        delete next[region]
      } else {
        next[region] = 5
      }
      return next
    })
  }

  function setRegionIntensity(region: string, value: number) {
    setSelectedRegions(prev => ({ ...prev, [region]: value }))
  }

  function addCustomRegion() {
    const region = customDiscomfort.trim()
    if (!region) return
    if (selectedRegions[region] !== undefined) {
      toast.error('Região já selecionada.')
      return
    }
    setSelectedRegions(prev => ({ ...prev, [region]: 5 }))
    setCustomDiscomfort('')
  }

  async function handleSaveDiscomforts() {
    if (!selectedSession) return
    setSavingDiscomforts(true)

    // Delete all existing records for this session
    await supabase.from('discomfort_records').delete().eq('session_id', selectedSession.id)

    // Insert current selections
    const regions = Object.entries(selectedRegions)
    if (regions.length > 0) {
      const { error } = await supabase.from('discomfort_records').insert(
        regions.map(([region, intensity]) => ({
          session_id: selectedSession.id,
          patient_id: patientId,
          body_region: region,
          pain_intensity: intensity,
        }))
      )
      if (error) {
        toast.error('Erro ao salvar desconfortos.')
        setSavingDiscomforts(false)
        return
      }
    }

    setSavingDiscomforts(false)
    toast.success('Desconfortos salvos!')
  }

  async function handleAddClinicalNote() {
    if (!selectedSession || !newClinicalNote.trim()) {
      toast.error('Digite uma nota clinica.')
      return
    }
    const { data, error } = await supabase
      .from('clinical_notes')
      .insert({
        session_id: selectedSession.id,
        patient_id: patientId,
        note_text: newClinicalNote.trim(),
      })
      .select()
      .single()
    if (error) {
      toast.error('Erro ao adicionar nota.')
    } else if (data) {
      setClinicalNotes(prev => [...prev, data])
      setNewClinicalNote('')
      toast.success('Nota adicionada!')
    }
  }

  async function handleDeleteClinicalNote(id: string) {
    const { error } = await supabase.from('clinical_notes').delete().eq('id', id)
    if (!error) {
      setClinicalNotes(prev => prev.filter(n => n.id !== id))
    }
  }

  // ── Photo handling ──

  async function validateAndUploadPhoto(file: File, photoType: string) {
    if (!selectedSession) return

    setValidationError(null)
    setValidatingType(photoType)

    // Step 1: Validate with AI
    const formData = new FormData()
    formData.append('photo', file)
    formData.append('photo_type', photoType)

    try {
      const valResponse = await fetch('/api/ai/validate-photo', {
        method: 'POST',
        body: formData,
      })

      if (!valResponse.ok) {
        const err = await valResponse.json()
        toast.error(err.error || 'Erro na validação da foto')
        setValidatingType(null)
        return
      }

      const validation = await valResponse.json()

      if (!validation.valid) {
        setValidationError({
          type: photoType,
          message: validation.reason || 'Foto não aprovada para análise postural.',
          issues: validation.issues || [],
        })
        setValidatingType(null)
        toast.error('Foto rejeitada. Veja os detalhes abaixo.')
        return
      }

      setValidatingType(null)

      // Step 2: Upload to storage
      setUploadingType(photoType)

      const ext = file.name.split('.').pop() || 'jpg'
      const filePath = `${patientId}/${selectedSession.id}/${photoType}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('patient-photos')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        toast.error('Erro ao fazer upload da foto.')
        setUploadingType(null)
        return
      }

      // Check if record already exists for this session + type
      const existing = sessionPhotos.find(
        p => p.session_id === selectedSession.id && p.photo_type === photoType
      )

      if (existing) {
        await supabase
          .from('patient_photos')
          .update({ photo_url: filePath })
          .eq('id', existing.id)
      } else {
        await supabase.from('patient_photos').insert({
          session_id: selectedSession.id,
          patient_id: patientId,
          photo_type: photoType,
          photo_url: filePath,
        })
      }

      // Refresh photos
      const { data: signedData } = await supabase.storage
        .from('patient-photos')
        .createSignedUrl(filePath, 3600)

      if (existing) {
        setSessionPhotos(prev =>
          prev.map(p =>
            p.id === existing.id
              ? { ...p, photo_url: signedData?.signedUrl ?? filePath }
              : p
          )
        )
      } else {
        // Re-fetch to get the new record with ID
        const { data: newPhotos } = await supabase
          .from('patient_photos')
          .select('*')
          .eq('session_id', selectedSession.id)
          .eq('photo_type', photoType)
          .single()
        if (newPhotos) {
          setSessionPhotos(prev => [
            ...prev.filter(p => p.photo_type !== photoType),
            { ...newPhotos, photo_url: signedData?.signedUrl ?? filePath },
          ])
        }
      }

      setUploadingType(null)
      toast.success(`Foto ${PHOTO_TYPE_LABELS[photoType]} aprovada e salva!`)
    } catch (err) {
      console.error('Photo validation/upload error:', err)
      toast.error('Erro ao processar a foto.')
      setValidatingType(null)
      setUploadingType(null)
    }
  }

  async function handleDeletePhoto(photo: PatientPhoto) {
    // Delete from storage (use the original path, not signed URL)
    const { data: photoRecord } = await supabase
      .from('patient_photos')
      .select('photo_url')
      .eq('id', photo.id)
      .single()

    if (photoRecord) {
      await supabase.storage.from('patient-photos').remove([photoRecord.photo_url])
    }

    await supabase.from('patient_photos').delete().eq('id', photo.id)
    setSessionPhotos(prev => prev.filter(p => p.id !== photo.id))
    toast.success('Foto excluída.')
  }

  function getPhotoForType(photoType: string): PatientPhoto | undefined {
    return sessionPhotos.find(p => p.photo_type === photoType)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>, photoType: string) {
    const file = e.target.files?.[0]
    if (file) {
      validateAndUploadPhoto(file, photoType)
    }
    // Reset input
    e.target.value = ''
  }

  // ── AI Postural Analysis ──

  async function handleRunAnalysis() {
    if (!selectedSession) return

    const photosAvailable = sessionPhotos.length
    if (photosAvailable === 0) {
      toast.error('Tire pelo menos uma foto postural antes de solicitar a análise.')
      return
    }

    setAnalyzing(true)

    try {
      // Get signed URLs for all session photos
      const photoUrls: Record<string, string> = {}
      for (const photo of sessionPhotos) {
        // Get original path from DB
        const { data: record } = await supabase
          .from('patient_photos')
          .select('photo_url, photo_type')
          .eq('id', photo.id)
          .single()
        if (record) {
          const { data: signed } = await supabase.storage
            .from('patient-photos')
            .createSignedUrl(record.photo_url, 600)
          if (signed?.signedUrl) {
            photoUrls[record.photo_type] = signed.signedUrl
          }
        }
      }

      // Get patient data
      const { data: patient } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single()

      // Get exams
      const { data: exams } = await supabase
        .from('patient_exams')
        .select('exam_description, ai_analysis')
        .eq('patient_id', patientId)

      // Get previous analysis (from any earlier session)
      const { data: prevAnalysis } = await supabase
        .from('posture_analyses')
        .select('analysis_text, created_at')
        .eq('patient_id', patientId)
        .neq('session_a_id', selectedSession.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const response = await fetch('/api/ai/analyze-posture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoUrls,
          patientData: patient,
          exams: exams || [],
          previousAnalysis: prevAnalysis?.analysis_text || null,
          sessionNumber: selectedSession.session_number,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        toast.error(err.error || 'Erro na análise postural.')
        setAnalyzing(false)
        return
      }

      const result = await response.json()

      // Save analysis to DB
      const { data: savedAnalysis, error } = await supabase
        .from('posture_analyses')
        .insert({
          patient_id: patientId,
          session_a_id: selectedSession.id,
          session_b_id: prevAnalysis ? null : null, // Only session_a for single analysis
          analysis_text: result.analysis,
          analysis_type: result.type || 'single',
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving analysis:', error)
        toast.error('Análise gerada mas erro ao salvar.')
      } else {
        setCurrentAnalysis(savedAnalysis)
        toast.success('Análise postural concluída!')
      }
    } catch (err) {
      console.error('Analysis error:', err)
      toast.error('Erro ao gerar análise postural.')
    }

    setAnalyzing(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    )
  }

  // Group sessions by plan
  const sessionsByPlan: Record<string, TreatmentSession[]> = {}
  for (const session of sessions) {
    if (!sessionsByPlan[session.plan_id]) sessionsByPlan[session.plan_id] = []
    sessionsByPlan[session.plan_id].push(session)
  }

  // Check if all active plans have all sessions completed
  const allActivePlansCompleted = plans
    .filter(p => p.active)
    .every(p => {
      const ps = sessionsByPlan[p.id] ?? []
      return ps.length > 0 && ps.every(s => s.completed)
    })

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Sessoes</h2>

      {plans.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          Nenhum plano cadastrado. Crie um plano na aba Planos.
        </div>
      ) : (
        plans.map(plan => {
          const planSessions = sessionsByPlan[plan.id] ?? []
          const completedCount = planSessions.filter(s => s.completed).length
          return (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{plan.plan_name}</CardTitle>
                  <Badge variant="outline">
                    {completedCount}/{plan.total_sessions} concluidas
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {planSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma sessao.</p>
                ) : (
                  planSessions.map(session => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleToggleCompleted(session)}
                          className={cn(
                            'flex h-5 w-5 items-center justify-center rounded border transition-colors',
                            session.completed
                              ? 'border-teal-600 bg-teal-600 text-white'
                              : 'border-gray-300 hover:border-teal-400'
                          )}
                        >
                          {session.completed && <Check className="h-3 w-3" />}
                        </button>
                        <div>
                          <span className={cn('text-sm font-medium', session.completed && 'line-through text-muted-foreground')}>
                            Sessao {session.session_number}
                          </span>
                          {session.session_date ? (
                            <p className="text-xs text-muted-foreground">
                              {(() => {
                                const d = new Date(session.session_date)
                                return isNaN(d.getTime()) ? 'Sem data' : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                              })()}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Sem data</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDetail(session)}
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        Detalhes
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>

              {/* Offer new protocol when plan is fully completed */}
              {completedCount === plan.total_sessions && plan.total_sessions > 0 && !celebrationDismissed.has(plan.id) && (
                <CardContent className="border-t pt-4">
                  <div className="rounded-lg border-2 border-dashed border-teal-300 bg-teal-50 p-4 text-center">
                    <PartyPopper className="mx-auto mb-2 h-6 w-6 text-teal-600" />
                    <p className="font-medium text-teal-800">Plano concluído!</p>
                    <p className="text-sm text-teal-600 mb-3">
                      Todas as {plan.total_sessions} sessões foram realizadas. Deseja oferecer um novo protocolo?
                    </p>
                    <div className="flex justify-center gap-2">
                      <Button
                        size="sm"
                        className="bg-teal-600 hover:bg-teal-700"
                        onClick={() => {
                          setCelebrationDismissed(prev => new Set(prev).add(plan.id))
                          onRequestNewPlan?.()
                        }}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Novo Plano
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCelebrationDismissed(prev => new Set(prev).add(plan.id))}
                      >
                        Fechar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })
      )}

      {/* Session Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Sessao {selectedSession?.session_number}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Session notes */}
            <div className="space-y-2">
              <Label>Observacoes da sessao</Label>
              <Textarea
                value={sessionNotes}
                onChange={e => setSessionNotes(e.target.value)}
                rows={3}
              />
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700"
                onClick={handleSaveSessionNotes}
                disabled={saving}
              >
                {saving ? 'Salvando...' : 'Salvar observacoes'}
              </Button>
            </div>

            {/* ── Postural Photos ── */}
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Fotos Posturais
              </h3>
              <p className="text-xs text-muted-foreground">
                Tire ou selecione fotos do paciente nos 4 ângulos. A IA validará automaticamente cada foto antes de aceitar.
              </p>

              {/* Validation error */}
              {validationError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-800">
                        Foto {PHOTO_TYPE_LABELS[validationError.type]} rejeitada
                      </p>
                      <p className="text-sm text-red-700 mt-1">{validationError.message}</p>
                      {validationError.issues.length > 0 && (
                        <ul className="mt-1 list-disc pl-4 text-xs text-red-600">
                          {validationError.issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <button onClick={() => setValidationError(null)}>
                      <X className="h-4 w-4 text-red-400" />
                    </button>
                  </div>
                </div>
              )}

              {/* Photo grid */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {PHOTO_TYPES.map(pt => {
                  const photo = getPhotoForType(pt.value)
                  const isValidating = validatingType === pt.value
                  const isUploading = uploadingType === pt.value
                  const isBusy = isValidating || isUploading

                  return (
                    <div key={pt.value} className="space-y-1.5">
                      <p className="text-center text-xs font-medium text-muted-foreground">
                        {pt.label}
                      </p>
                      <div className="relative aspect-[3/4] overflow-hidden rounded-lg border bg-gray-50">
                        {photo ? (
                          <>
                            <img
                              src={photo.photo_url}
                              alt={pt.label}
                              className="h-full w-full object-cover"
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute right-1 top-1 h-6 w-6"
                              onClick={() => handleDeletePhoto(photo)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            <Badge
                              className="absolute bottom-1 left-1 bg-green-600 text-[10px]"
                            >
                              IA ✓
                            </Badge>
                          </>
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-2">
                            {isBusy ? (
                              <div className="flex flex-col items-center gap-1">
                                <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                                <span className="text-[10px] text-muted-foreground text-center">
                                  {isValidating ? 'Validando com IA...' : 'Enviando...'}
                                </span>
                              </div>
                            ) : (
                              <>
                                {/* Camera button */}
                                <button
                                  className="flex flex-col items-center gap-1 rounded-md border border-dashed border-teal-400 px-3 py-2 text-teal-600 transition-colors hover:bg-teal-50"
                                  onClick={() => cameraInputRefs.current[pt.value]?.click()}
                                >
                                  <Camera className="h-5 w-5" />
                                  <span className="text-[10px]">Câmera</span>
                                </button>
                                {/* Gallery button */}
                                <button
                                  className="flex flex-col items-center gap-1 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-muted-foreground transition-colors hover:bg-gray-100"
                                  onClick={() => fileInputRefs.current[pt.value]?.click()}
                                >
                                  <Upload className="h-4 w-4" />
                                  <span className="text-[10px]">Galeria</span>
                                </button>
                                {/* Hidden inputs */}
                                <input
                                  ref={el => { cameraInputRefs.current[pt.value] = el }}
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="hidden"
                                  onChange={e => handleFileSelect(e, pt.value)}
                                />
                                <input
                                  ref={el => { fileInputRefs.current[pt.value] = el }}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={e => handleFileSelect(e, pt.value)}
                                />
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* AI Analysis button */}
              <div className="flex flex-col gap-2">
                <Button
                  className="bg-purple-600 hover:bg-purple-700 w-full"
                  onClick={handleRunAnalysis}
                  disabled={analyzing || sessionPhotos.length === 0}
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analisando postura com IA...
                    </>
                  ) : (
                    <>
                      <Brain className="mr-2 h-4 w-4" />
                      {currentAnalysis ? 'Refazer Análise Postural com IA' : 'Gerar Análise Postural com IA'}
                    </>
                  )}
                </Button>
                {sessionPhotos.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Tire pelo menos uma foto para habilitar a análise.
                  </p>
                )}
                {sessionPhotos.length > 0 && sessionPhotos.length < 4 && (
                  <p className="text-xs text-amber-600 text-center">
                    {4 - sessionPhotos.length} foto(s) faltando. A análise será mais precisa com os 4 ângulos.
                  </p>
                )}
              </div>

              {/* AI Analysis result */}
              {currentAnalysis && (
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="h-4 w-4 text-purple-700" />
                    <h4 className="font-medium text-purple-900">Análise Postural IA</h4>
                    <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700">
                      {currentAnalysis.analysis_type === 'compare' ? 'Comparativa' : 'Individual'}
                    </Badge>
                    <span className="ml-auto text-xs text-purple-600">
                      {new Date(currentAnalysis.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="prose prose-sm max-w-none text-purple-950 whitespace-pre-wrap">
                    {currentAnalysis.analysis_text}
                  </div>
                </div>
              )}
            </div>

            {/* Discomfort Records */}
            <div className="space-y-3">
              <h3 className="font-medium">Desconfortos</h3>

              {/* Toggle buttons for body regions */}
              <div className="flex flex-wrap gap-1.5">
                {BODY_REGIONS.map(region => {
                  const isSelected = selectedRegions[region] !== undefined
                  return (
                    <Button
                      key={region}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className={cn(
                        'h-7 text-xs px-2.5',
                        isSelected && 'bg-teal-600 hover:bg-teal-700'
                      )}
                      onClick={() => toggleRegion(region)}
                    >
                      {region}
                    </Button>
                  )
                })}
                {/* Show custom regions not in BODY_REGIONS */}
                {Object.keys(selectedRegions)
                  .filter(r => !BODY_REGIONS.includes(r as typeof BODY_REGIONS[number]))
                  .map(region => (
                    <Button
                      key={region}
                      type="button"
                      variant="default"
                      size="sm"
                      className="h-7 text-xs px-2.5 bg-teal-600 hover:bg-teal-700"
                      onClick={() => toggleRegion(region)}
                    >
                      {region}
                    </Button>
                  ))}
              </div>

              {/* Custom region input */}
              <div className="flex gap-2">
                <Input
                  value={customDiscomfort}
                  onChange={e => setCustomDiscomfort(e.target.value)}
                  placeholder="Outro desconforto..."
                  className="text-sm"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCustomRegion()
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCustomRegion}
                  disabled={!customDiscomfort.trim()}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Adicionar
                </Button>
              </div>

              {/* Intensity sliders for selected regions */}
              {Object.keys(selectedRegions).length > 0 && (
                <div className="space-y-2">
                  {Object.entries(selectedRegions).map(([region, intensity]) => (
                    <div key={region} className="flex items-center gap-2">
                      <span className="w-24 text-sm truncate shrink-0">{region}</span>
                      <input
                        type="range"
                        min={0}
                        max={10}
                        value={intensity}
                        onChange={e => setRegionIntensity(region, parseInt(e.target.value))}
                        className="flex-1 accent-teal-600"
                      />
                      <span className={cn(
                        'w-6 text-center text-sm font-bold',
                        intensity <= 3 ? 'text-green-600' : intensity <= 6 ? 'text-amber-600' : 'text-red-600'
                      )}>
                        {intensity}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleRegion(region)}
                        className="text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Save discomforts button */}
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700"
                onClick={handleSaveDiscomforts}
                disabled={savingDiscomforts}
              >
                {savingDiscomforts ? 'Salvando...' : 'Salvar desconfortos'}
              </Button>
            </div>

            {/* Clinical Notes */}
            <div className="space-y-3">
              <h3 className="font-medium">Notas Clinicas</h3>
              {clinicalNotes.map(note => (
                <div key={note.id} className="flex items-start justify-between rounded-lg border p-2">
                  <div className="text-sm">
                    <p>{note.note_text}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(note.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleDeleteClinicalNote(note.id)}
                  >
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                </div>
              ))}

              <div className="flex gap-2">
                <Textarea
                  value={newClinicalNote}
                  onChange={e => setNewClinicalNote(e.target.value)}
                  placeholder="Nova nota clinica..."
                  rows={2}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 self-end"
                  onClick={handleAddClinicalNote}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Adicionar
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

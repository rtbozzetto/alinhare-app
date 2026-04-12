'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTreatmentPlans } from '@/hooks/use-treatment-plans'
import { createClient } from '@/lib/supabase/client'
import { type PatientPhoto, type PostureAnalysis, type TreatmentSession } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PHOTO_TYPES } from '@/lib/constants'
import { ImageIcon, Brain, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PhotosTabProps {
  patientId: string
}

interface SessionPhotoGroup {
  session: TreatmentSession
  planName: string
  photos: PatientPhoto[]
  analysis: PostureAnalysis | null
}

export function PhotosTab({ patientId }: PhotosTabProps) {
  const { plans, sessions, fetchPlans, fetchSessions, loading } = useTreatmentPlans(patientId)
  const supabase = createClient()

  const [groups, setGroups] = useState<SessionPhotoGroup[]>([])
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [expandedAnalyses, setExpandedAnalyses] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  useEffect(() => {
    if (plans.length > 0) {
      fetchSessions()
    }
  }, [plans, fetchSessions])

  const loadAllPhotos = useCallback(async () => {
    if (sessions.length === 0) return
    setLoadingPhotos(true)

    // Fetch all photos for this patient
    const { data: allPhotos } = await supabase
      .from('patient_photos')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at')

    // Fetch all analyses for this patient
    const { data: allAnalyses } = await supabase
      .from('posture_analyses')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })

    if (!allPhotos) {
      setLoadingPhotos(false)
      return
    }

    // Get signed URLs
    const photosWithUrls = await Promise.all(
      allPhotos.map(async (photo) => {
        const { data: signedData } = await supabase.storage
          .from('patient-photos')
          .createSignedUrl(photo.photo_url, 3600)
        return { ...photo, photo_url: signedData?.signedUrl ?? photo.photo_url }
      })
    )

    // Group by session — only sessions that have photos
    const sessionGroups: SessionPhotoGroup[] = []
    for (const session of sessions) {
      const sessionPhotos = photosWithUrls.filter(p => p.session_id === session.id)
      if (sessionPhotos.length === 0) continue

      const plan = plans.find(p => p.id === session.plan_id)
      const analysis = allAnalyses?.find(a => a.session_a_id === session.id) ?? null

      sessionGroups.push({
        session,
        planName: plan?.plan_name ?? 'Plano',
        photos: sessionPhotos,
        analysis,
      })
    }

    // Sort by session date descending (most recent first)
    sessionGroups.sort((a, b) => {
      const dateA = a.session.session_date || ''
      const dateB = b.session.session_date || ''
      return dateB.localeCompare(dateA)
    })

    setGroups(sessionGroups)
    setLoadingPhotos(false)
  }, [supabase, patientId, sessions, plans])

  useEffect(() => {
    if (sessions.length > 0) {
      loadAllPhotos()
    }
  }, [sessions, loadAllPhotos])

  if (loading || loadingPhotos) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Fotos Posturais</h2>

      {groups.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          <ImageIcon className="mx-auto mb-2 h-8 w-8" />
          <p>Nenhuma foto postural registrada.</p>
          <p className="text-xs mt-1">As fotos são tiradas na aba Sessões, dentro dos detalhes de cada sessão.</p>
        </div>
      ) : (
        groups.map(group => (
          <Card key={group.session.id}>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base">
                  Sessão {group.session.session_number}
                </CardTitle>
                <Badge variant="outline">{group.planName}</Badge>
                {group.session.session_date && !isNaN(new Date(group.session.session_date + 'T12:00:00').getTime()) && (
                  <span className="text-sm text-muted-foreground">
                    {new Date(group.session.session_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </span>
                )}
                {group.analysis && (
                  <Badge className="bg-purple-100 text-purple-700 border-purple-300">
                    <Brain className="mr-1 h-3 w-3" />
                    Análise IA
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Photo grid */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {PHOTO_TYPES.map(pt => {
                  const photo = group.photos.find(p => p.photo_type === pt.value)
                  return (
                    <div key={pt.value} className="space-y-1">
                      <p className="text-center text-xs font-medium text-muted-foreground">
                        {pt.label}
                      </p>
                      <div className="relative aspect-[3/4] overflow-hidden rounded-lg border bg-gray-50">
                        {photo ? (
                          <img
                            src={photo.photo_url}
                            alt={pt.label}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <ImageIcon className="h-6 w-6 opacity-30" />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* AI Analysis */}
              {group.analysis && (
                <div className="rounded-lg border border-purple-200 bg-purple-50">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 p-4 text-left"
                    onClick={() => setExpandedAnalyses(prev => {
                      const next = new Set(prev)
                      if (next.has(group.session.id)) {
                        next.delete(group.session.id)
                      } else {
                        next.add(group.session.id)
                      }
                      return next
                    })}
                  >
                    <Brain className="h-4 w-4 text-purple-700 shrink-0" />
                    <h4 className="font-medium text-purple-900">Análise Postural IA</h4>
                    <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700">
                      {group.analysis.analysis_type === 'compare' ? 'Comparativa' : 'Individual'}
                    </Badge>
                    <span className="ml-auto text-xs text-purple-600 whitespace-nowrap">
                      {new Date(group.analysis.created_at).toLocaleString('pt-BR')}
                    </span>
                    <ChevronDown className={cn(
                      'h-4 w-4 text-purple-600 shrink-0 transition-transform duration-200',
                      expandedAnalyses.has(group.session.id) && 'rotate-180'
                    )} />
                  </button>
                  {expandedAnalyses.has(group.session.id) && (
                    <div className="px-4 pb-4">
                      <div className="prose prose-sm max-w-none text-purple-950 whitespace-pre-wrap text-sm">
                        {group.analysis.analysis_text}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

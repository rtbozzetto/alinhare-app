'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTreatmentPlans } from '@/hooks/use-treatment-plans'
import { createClient } from '@/lib/supabase/client'
import { type PatientPhoto, type TreatmentSession } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PHOTO_TYPES } from '@/lib/constants'
import { toast } from 'sonner'
import { Upload, Trash2, Image as ImageIcon } from 'lucide-react'

interface PhotosTabProps {
  patientId: string
}

export function PhotosTab({ patientId }: PhotosTabProps) {
  const { plans, sessions, fetchPlans, fetchSessions, loading } = useTreatmentPlans(patientId)
  const supabase = createClient()

  const [photos, setPhotos] = useState<PatientPhoto[]>([])
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  useEffect(() => {
    if (plans.length > 0) {
      fetchSessions()
    }
  }, [plans, fetchSessions])

  const fetchPhotos = useCallback(async () => {
    setLoadingPhotos(true)
    const { data } = await supabase
      .from('patient_photos')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at')
    if (data) {
      // Get signed URLs for each photo
      const photosWithUrls = await Promise.all(
        data.map(async (photo) => {
          const { data: signedData } = await supabase.storage
            .from('patient-photos')
            .createSignedUrl(photo.photo_url, 3600)
          return { ...photo, photo_url: signedData?.signedUrl ?? photo.photo_url }
        })
      )
      setPhotos(photosWithUrls)
    }
    setLoadingPhotos(false)
  }, [supabase, patientId])

  useEffect(() => {
    fetchPhotos()
  }, [fetchPhotos])

  async function handleUpload(
    sessionId: string,
    photoType: string,
    file: File
  ) {
    const uploadKey = `${sessionId}-${photoType}`
    setUploading(uploadKey)

    const ext = file.name.split('.').pop()
    const filePath = `${patientId}/${sessionId}/${photoType}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('patient-photos')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      toast.error('Erro ao fazer upload da foto.')
      setUploading(null)
      return
    }

    // Check if photo record already exists
    const existingPhoto = photos.find(
      p => p.session_id === sessionId && p.photo_type === photoType
    )

    if (existingPhoto) {
      await supabase
        .from('patient_photos')
        .update({ photo_url: filePath })
        .eq('id', existingPhoto.id)
    } else {
      await supabase.from('patient_photos').insert({
        session_id: sessionId,
        patient_id: patientId,
        photo_type: photoType,
        photo_url: filePath,
      })
    }

    setUploading(null)
    toast.success('Foto enviada!')
    fetchPhotos()
  }

  async function handleDelete(photo: PatientPhoto) {
    // Delete from storage
    const pathParts = photo.photo_url.split('patient-photos/')
    const storagePath = pathParts.length > 1 ? pathParts[1] : photo.photo_url
    await supabase.storage.from('patient-photos').remove([storagePath])

    // Delete record
    await supabase.from('patient_photos').delete().eq('id', photo.id)
    setPhotos(prev => prev.filter(p => p.id !== photo.id))
    toast.success('Foto excluida.')
  }

  function getPhotoForSlot(sessionId: string, photoType: string): PatientPhoto | undefined {
    return photos.find(p => p.session_id === sessionId && p.photo_type === photoType)
  }

  if (loading || loadingPhotos) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    )
  }

  const completedSessions = sessions.filter(s => s.completed)

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Fotos</h2>

      {completedSessions.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          Nenhuma sessao concluida. As fotos sao organizadas por sessao.
        </div>
      ) : (
        completedSessions.map(session => {
          const plan = plans.find(p => p.id === session.plan_id)
          return (
            <Card key={session.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    Sessao {session.session_number}
                  </CardTitle>
                  {plan && (
                    <Badge variant="outline">{plan.plan_name}</Badge>
                  )}
                  {session.session_date && (
                    <span className="text-sm text-muted-foreground">
                      {new Date(session.session_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {PHOTO_TYPES.map(pt => {
                    const photo = getPhotoForSlot(session.id, pt.value)
                    const isUploading = uploading === `${session.id}-${pt.value}`

                    return (
                      <div key={pt.value} className="space-y-2">
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
                                size="icon-xs"
                                className="absolute right-1 top-1"
                                onClick={() => handleDelete(photo)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:bg-gray-100">
                              {isUploading ? (
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
                              ) : (
                                <>
                                  <ImageIcon className="h-6 w-6" />
                                  <span className="text-xs">Upload</span>
                                </>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => {
                                  const file = e.target.files?.[0]
                                  if (file) handleUpload(session.id, pt.value, file)
                                }}
                                disabled={isUploading}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}

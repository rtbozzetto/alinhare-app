'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type PatientExam } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Upload, Trash2, FileText, Brain, ExternalLink } from 'lucide-react'

interface ExamsTabProps {
  patientId: string
}

export function ExamsTab({ patientId }: ExamsTabProps) {
  const supabase = createClient()
  const [exams, setExams] = useState<PatientExam[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [description, setDescription] = useState('')
  const [selectedExam, setSelectedExam] = useState<PatientExam | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const fetchExams = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('patient_exams')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })

    if (data) {
      // Get signed URLs
      const examsWithUrls = await Promise.all(
        data.map(async (exam) => {
          const { data: signedData } = await supabase.storage
            .from('exam-files')
            .createSignedUrl(exam.file_url, 3600)
          return { ...exam, file_url: signedData?.signedUrl ?? exam.file_url }
        })
      )
      setExams(examsWithUrls)
    }
    setLoading(false)
  }, [supabase, patientId])

  useEffect(() => {
    fetchExams()
  }, [fetchExams])

  async function handleUpload(file: File) {
    setUploading(true)

    const ext = file.name.split('.').pop()
    const filePath = `${patientId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('exam-files')
      .upload(filePath, file)

    if (uploadError) {
      toast.error('Erro ao fazer upload do exame.')
      setUploading(false)
      return
    }

    const { error } = await supabase.from('patient_exams').insert({
      patient_id: patientId,
      file_name: file.name,
      file_url: filePath,
      file_type: file.type,
      exam_description: description || null,
    })

    setUploading(false)
    if (error) {
      toast.error('Erro ao registrar exame.')
    } else {
      toast.success('Exame enviado com sucesso!')
      setDescription('')
      fetchExams()
    }
  }

  async function handleDelete(exam: PatientExam) {
    // Delete from storage
    const pathParts = exam.file_url.split('exam-files/')
    const storagePath = pathParts.length > 1 ? pathParts[1] : exam.file_url
    await supabase.storage.from('exam-files').remove([storagePath])

    // Delete record
    await supabase.from('patient_exams').delete().eq('id', exam.id)
    setExams(prev => prev.filter(e => e.id !== exam.id))
    toast.success('Exame excluido.')
  }

  function openDetail(exam: PatientExam) {
    setSelectedExam(exam)
    setDetailOpen(true)
  }

  function handleOpenFile(url: string) {
    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Exames</h2>

      {/* Upload area */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="space-y-2">
            <Label>Descricao do exame (opcional)</Label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Ressonancia lombar"
            />
          </div>
          <div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors hover:border-teal-400 hover:bg-teal-50/50">
              {uploading ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
                  <span className="text-sm">Enviando...</span>
                </div>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Clique para enviar arquivo (PDF, imagem, etc.)
                  </span>
                </>
              )}
              <input
                type="file"
                accept="image/*,application/pdf,.doc,.docx"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(file)
                }}
                disabled={uploading}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Exam list */}
      {exams.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          Nenhum exame cadastrado.
        </div>
      ) : (
        <div className="grid gap-3">
          {exams.map(exam => (
            <Card key={exam.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-teal-600" />
                  <div>
                    <p className="font-medium">{exam.file_name}</p>
                    {exam.exam_description && (
                      <p className="text-sm text-muted-foreground">{exam.exam_description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(exam.created_at).toLocaleDateString('pt-BR')}
                    </p>
                    {exam.ai_analysis && (
                      <Badge variant="default" className="mt-1 bg-purple-600">
                        <Brain className="mr-1 h-3 w-3" />
                        Analisado por IA
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenFile(exam.file_url)}
                  >
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Abrir
                  </Button>
                  {exam.ai_analysis && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDetail(exam)}
                    >
                      <Brain className="mr-1 h-3 w-3" />
                      Ver analise
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    title="Analise IA (em breve)"
                  >
                    <Brain className="mr-1 h-3 w-3" />
                    Analisar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(exam)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* AI Analysis Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Analise IA - {selectedExam?.file_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {selectedExam?.exam_description && (
              <p className="text-sm text-muted-foreground">
                {selectedExam.exam_description}
              </p>
            )}
            <div className="rounded-lg bg-gray-50 p-4 text-sm whitespace-pre-wrap">
              {selectedExam?.ai_analysis ?? 'Sem analise disponivel.'}
            </div>
            {selectedExam?.analyzed_at && (
              <p className="text-xs text-muted-foreground">
                Analisado em: {new Date(selectedExam.analyzed_at).toLocaleString('pt-BR')}
              </p>
            )}
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

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTreatmentPlans } from '@/hooks/use-treatment-plans'
import { createClient } from '@/lib/supabase/client'
import { type TreatmentSession, type DiscomfortRecord, type ClinicalNote } from '@/types/database'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BODY_REGIONS } from '@/lib/constants'
import { toast } from 'sonner'
import { Check, Eye, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SessionsTabProps {
  patientId: string
}

export function SessionsTab({ patientId }: SessionsTabProps) {
  const { plans, sessions, loading, fetchPlans, fetchSessions, updateSession } =
    useTreatmentPlans(patientId)
  const supabase = createClient()

  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<TreatmentSession | null>(null)
  const [sessionNotes, setSessionNotes] = useState('')
  const [discomfortRecords, setDiscomfortRecords] = useState<DiscomfortRecord[]>([])
  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNote[]>([])

  // New discomfort form
  const [newRegion, setNewRegion] = useState('')
  const [newIntensity, setNewIntensity] = useState(5)
  const [newDiscomfortNotes, setNewDiscomfortNotes] = useState('')

  // New clinical note form
  const [newClinicalNote, setNewClinicalNote] = useState('')

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  useEffect(() => {
    if (plans.length > 0) {
      fetchSessions()
    }
  }, [plans, fetchSessions])

  const loadSessionDetails = useCallback(async (session: TreatmentSession) => {
    // Load discomfort records
    const { data: discomforts } = await supabase
      .from('discomfort_records')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at')
    if (discomforts) setDiscomfortRecords(discomforts)

    // Load clinical notes
    const { data: notes } = await supabase
      .from('clinical_notes')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at')
    if (notes) setClinicalNotes(notes)
  }, [supabase])

  function openDetail(session: TreatmentSession) {
    setSelectedSession(session)
    setSessionNotes(session.notes ?? '')
    setDiscomfortRecords([])
    setClinicalNotes([])
    setNewRegion('')
    setNewIntensity(5)
    setNewDiscomfortNotes('')
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

  async function handleAddDiscomfort() {
    if (!selectedSession || !newRegion) {
      toast.error('Selecione uma regiao.')
      return
    }
    const { data, error } = await supabase
      .from('discomfort_records')
      .insert({
        session_id: selectedSession.id,
        patient_id: patientId,
        body_region: newRegion,
        pain_intensity: newIntensity,
        notes: newDiscomfortNotes || null,
      })
      .select()
      .single()
    if (error) {
      toast.error('Erro ao adicionar registro.')
    } else if (data) {
      setDiscomfortRecords(prev => [...prev, data])
      setNewRegion('')
      setNewIntensity(5)
      setNewDiscomfortNotes('')
      toast.success('Registro adicionado!')
    }
  }

  async function handleDeleteDiscomfort(id: string) {
    const { error } = await supabase.from('discomfort_records').delete().eq('id', id)
    if (!error) {
      setDiscomfortRecords(prev => prev.filter(d => d.id !== id))
    }
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
                          {session.session_date && (
                            <p className="text-xs text-muted-foreground">
                              {new Date(session.session_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </p>
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
            </Card>
          )
        })
      )}

      {/* Session Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
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

            {/* Discomfort Records */}
            <div className="space-y-3">
              <h3 className="font-medium">Registros de Desconforto</h3>
              {discomfortRecords.map(record => (
                <div key={record.id} className="flex items-center justify-between rounded-lg border p-2">
                  <div className="text-sm">
                    <span className="font-medium">{record.body_region}</span>
                    <span className="ml-2 text-muted-foreground">
                      Intensidade: {record.pain_intensity}/10
                    </span>
                    {record.notes && <p className="text-xs text-muted-foreground">{record.notes}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleDeleteDiscomfort(record.id)}
                  >
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                </div>
              ))}

              {/* Add new discomfort */}
              <div className="grid gap-2 rounded-lg border p-3 md:grid-cols-4">
                <Select value={newRegion} onValueChange={(value: string) => setNewRegion(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Regiao" />
                  </SelectTrigger>
                  <SelectContent>
                    {BODY_REGIONS.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={newIntensity}
                  onChange={e => setNewIntensity(parseInt(e.target.value) || 0)}
                  placeholder="Intensidade"
                />
                <Input
                  value={newDiscomfortNotes}
                  onChange={e => setNewDiscomfortNotes(e.target.value)}
                  placeholder="Notas (opcional)"
                />
                <Button
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700"
                  onClick={handleAddDiscomfort}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Adicionar
                </Button>
              </div>
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
                    size="icon-xs"
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

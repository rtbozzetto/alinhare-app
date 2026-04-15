'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePatients } from '@/hooks/use-patients'
import { type Patient } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  SEX_OPTIONS,
  BODY_REGIONS,
  DISCOMFORT_FREQUENCIES,
} from '@/lib/constants'
import { formatPhone, validatePhone, parseHeight, formatHeight } from '@/lib/utils'
import { toast } from 'sonner'
import { Save } from 'lucide-react'

interface PatientFormProps {
  patient?: Patient
}

export function PatientForm({ patient }: PatientFormProps) {
  const router = useRouter()
  const { createPatient, updatePatient } = usePatients()
  const isEdit = !!patient

  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: patient?.full_name ?? '',
    birth_date: patient?.birth_date ?? '',
    sex: patient?.sex ?? 'masculino' as Patient['sex'],
    phone: patient?.phone ?? '',
    cpf: patient?.cpf ?? '',
    email: patient?.email ?? '',
    address: patient?.address ?? '',
    height_cm: patient?.height_cm ? formatHeight(patient.height_cm) : '',
    sport: patient?.sport ?? '',
    surgery_history: patient?.surgery_history ?? '',
    medication: patient?.medication ?? '',
    health_problems: patient?.health_problems ?? '',
    main_complaint: patient?.main_complaint ?? '',
    general_notes: patient?.general_notes ?? '',
    discomfort_frequency: patient?.discomfort_frequency ?? '',
    discomfort_duration: patient?.discomfort_duration ?? '',
    discomfort_regions: (patient?.discomfort_regions ?? []) as string[],
    discomfort_intensities: (patient?.discomfort_intensities ?? {}) as Record<string, number>,
  })

  const [customRegion, setCustomRegion] = useState('')

  function addCustomRegion() {
    const region = customRegion.trim()
    if (!region) return
    if (form.discomfort_regions.includes(region)) {
      toast.error('Região já adicionada')
      return
    }
    setForm(prev => ({
      ...prev,
      discomfort_regions: [...prev.discomfort_regions, region],
      discomfort_intensities: { ...prev.discomfort_intensities, [region]: 5 },
    }))
    setCustomRegion('')
  }

  function updateField(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function toggleRegion(region: string) {
    setForm(prev => {
      const regions = prev.discomfort_regions.includes(region)
        ? prev.discomfort_regions.filter(r => r !== region)
        : [...prev.discomfort_regions, region]
      const intensities = { ...prev.discomfort_intensities }
      if (!regions.includes(region)) {
        delete intensities[region]
      } else if (!intensities[region]) {
        intensities[region] = 5
      }
      return { ...prev, discomfort_regions: regions, discomfort_intensities: intensities }
    })
  }

  function setIntensity(region: string, value: number) {
    setForm(prev => ({
      ...prev,
      discomfort_intensities: { ...prev.discomfort_intensities, [region]: value },
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.full_name.trim()) {
      toast.error('Nome e obrigatorio.')
      return
    }
    if (!form.phone || !validatePhone(form.phone)) {
      toast.error('Telefone e obrigatorio. Use o formato (XX) 9XXXX-XXXX.')
      return
    }

    const heightParsed = form.height_cm ? parseHeight(form.height_cm) : null

    const payload: Omit<Patient, 'id' | 'created_at' | 'updated_at'> = {
      full_name: form.full_name.trim(),
      birth_date: form.birth_date && /^\d{4}-\d{2}-\d{2}$/.test(form.birth_date) ? form.birth_date : null,
      sex: form.sex,
      phone: form.phone || null,
      cpf: form.cpf || null,
      email: form.email || null,
      address: form.address || null,
      height_cm: heightParsed,
      sport: form.sport || null,
      surgery_history: form.surgery_history || null,
      medication: form.medication || null,
      health_problems: form.health_problems || null,
      main_complaint: form.main_complaint || null,
      general_notes: form.general_notes || null,
      discomfort_frequency: form.discomfort_frequency || null,
      discomfort_duration: form.discomfort_duration || null,
      discomfort_regions: form.discomfort_regions.length > 0 ? form.discomfort_regions : null,
      discomfort_intensities: Object.keys(form.discomfort_intensities).length > 0 ? form.discomfort_intensities : null,
    }

    setSaving(true)
    if (isEdit) {
      const { error } = await updatePatient(patient.id, payload)
      setSaving(false)
      if (error) {
        toast.error('Erro ao atualizar paciente.')
      } else {
        toast.success('Paciente atualizado!')
      }
    } else {
      const { data, error } = await createPatient(payload)
      setSaving(false)
      if (error) {
        toast.error('Erro ao criar paciente.')
      } else {
        toast.success('Paciente criado com sucesso!')
        // Redireciona para o detalhe do paciente na aba de planos
        router.push(`/pacientes/${data?.id}?tab=planos`)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Dados Pessoais */}
      <Card>
        <CardHeader>
          <CardTitle>Dados Pessoais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nome completo *</Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={e => updateField('full_name', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Data de nascimento</Label>
            <div className="flex gap-2">
              <Input
                placeholder="DD"
                maxLength={2}
                className="w-14 sm:w-16 text-center"
                value={form.birth_date ? form.birth_date.split('-')[2] || '' : ''}
                onChange={e => {
                  const day = e.target.value.replace(/\D/g, '').slice(0, 2)
                  const parts = form.birth_date ? form.birth_date.split('-') : ['', '', '']
                  updateField('birth_date', `${parts[0] || ''}-${parts[1] || ''}-${day}`)
                }}
              />
              <span className="self-center text-muted-foreground">/</span>
              <Input
                placeholder="MM"
                maxLength={2}
                className="w-14 sm:w-16 text-center"
                value={form.birth_date ? form.birth_date.split('-')[1] || '' : ''}
                onChange={e => {
                  const month = e.target.value.replace(/\D/g, '').slice(0, 2)
                  const parts = form.birth_date ? form.birth_date.split('-') : ['', '', '']
                  updateField('birth_date', `${parts[0] || ''}-${month}-${parts[2] || ''}`)
                }}
              />
              <span className="self-center text-muted-foreground">/</span>
              <Input
                placeholder="AAAA"
                maxLength={4}
                className="w-16 sm:w-20 text-center"
                value={form.birth_date ? form.birth_date.split('-')[0] || '' : ''}
                onChange={e => {
                  const year = e.target.value.replace(/\D/g, '').slice(0, 4)
                  const parts = form.birth_date ? form.birth_date.split('-') : ['', '', '']
                  updateField('birth_date', `${year}-${parts[1] || ''}-${parts[2] || ''}`)
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Sexo</Label>
            <Select
              value={form.sex}
              onValueChange={(value: string) => updateField('sex', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEX_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone *</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={e => updateField('phone', formatPhone(e.target.value))}
              placeholder="(21) 99999-9999"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              value={form.cpf}
              onChange={e => updateField('cpf', e.target.value)}
              placeholder="000.000.000-00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={e => updateField('email', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Endereco</Label>
            <Input
              id="address"
              value={form.address}
              onChange={e => updateField('address', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="height">Altura (m)</Label>
            <Input
              id="height"
              value={form.height_cm}
              onChange={e => updateField('height_cm', e.target.value)}
              placeholder="1,70"
            />
          </div>
        </CardContent>
      </Card>

      {/* Atividades e Histórico */}
      <Card>
        <CardHeader>
          <CardTitle>Atividades e Histórico</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sport">Esporte / Atividade fisica</Label>
            <Input
              id="sport"
              value={form.sport}
              onChange={e => updateField('sport', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="surgery">Histórico cirúrgico</Label>
            <Input
              id="surgery"
              value={form.surgery_history}
              onChange={e => updateField('surgery_history', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="medication">Medicações</Label>
            <Input
              id="medication"
              value={form.medication}
              onChange={e => updateField('medication', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="health">Problemas de saude</Label>
            <Input
              id="health"
              value={form.health_problems}
              onChange={e => updateField('health_problems', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Queixa Principal */}
      <Card>
        <CardHeader>
          <CardTitle>Queixa Principal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="complaint">Queixa principal</Label>
            <Textarea
              id="complaint"
              value={form.main_complaint}
              onChange={e => updateField('main_complaint', e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Observacoes gerais</Label>
            <Textarea
              id="notes"
              value={form.general_notes}
              onChange={e => updateField('general_notes', e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Mapa de Desconforto */}
      <Card>
        <CardHeader>
          <CardTitle>Mapa de Desconforto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Frequencia</Label>
              <Select
                value={form.discomfort_frequency}
                onValueChange={(value: string) => updateField('discomfort_frequency', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {DISCOMFORT_FREQUENCIES.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duração</Label>
              <Input
                id="duration"
                value={form.discomfort_duration}
                onChange={e => updateField('discomfort_duration', e.target.value)}
                placeholder="Ex: 3 meses"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Regioes de desconforto</Label>
            <div className="flex flex-wrap gap-2">
              {BODY_REGIONS.map(region => {
                const selected = form.discomfort_regions.includes(region)
                return (
                  <Button
                    key={region}
                    type="button"
                    variant={selected ? 'default' : 'outline'}
                    size="sm"
                    className={selected ? 'bg-teal-600 hover:bg-teal-700' : ''}
                    onClick={() => toggleRegion(region)}
                  >
                    {region}
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Campo Outros - região personalizada */}
          <div className="space-y-2">
            <Label htmlFor="custom_region">Outros (especifique)</Label>
            <div className="flex gap-2">
              <Input
                id="custom_region"
                value={customRegion}
                onChange={e => setCustomRegion(e.target.value)}
                placeholder="Ex: Ombro direito posterior"
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
                onClick={addCustomRegion}
                disabled={!customRegion.trim()}
              >
                Adicionar
              </Button>
            </div>
            {form.discomfort_regions.filter(r => !BODY_REGIONS.includes(r as typeof BODY_REGIONS[number])).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.discomfort_regions
                  .filter(r => !BODY_REGIONS.includes(r as typeof BODY_REGIONS[number]))
                  .map(region => (
                    <Button
                      key={region}
                      type="button"
                      variant="default"
                      size="sm"
                      className="bg-teal-600 hover:bg-teal-700"
                      onClick={() => toggleRegion(region)}
                    >
                      {region} ×
                    </Button>
                  ))}
              </div>
            )}
          </div>

          {form.discomfort_regions.length > 0 && (
            <div className="space-y-3">
              <Label>Intensidade (0-10)</Label>
              {form.discomfort_regions.map(region => (
                <div key={region} className="flex items-center gap-2 sm:gap-3">
                  <span className="w-20 sm:w-28 text-xs sm:text-sm truncate">{region}</span>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={form.discomfort_intensities[region] ?? 5}
                    onChange={e => setIntensity(region, parseInt(e.target.value))}
                    className="flex-1 accent-teal-600"
                  />
                  <span className="w-8 text-center text-sm font-medium">
                    {form.discomfort_intensities[region] ?? 5}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="sticky bottom-0 -mx-2 sm:-mx-4 bg-background border-t p-3 sm:p-4 sm:static sm:mx-0 sm:border-0 sm:p-0 flex justify-end">
        <Button type="submit" className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700" disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Cadastrar Paciente'}
        </Button>
      </div>
    </form>
  )
}

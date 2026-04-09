'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProfessionals } from '@/hooks/use-professionals'
import { type Professional } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { formatPhone, validatePhone } from '@/lib/utils'
import { toast } from 'sonner'
import { Save } from 'lucide-react'

interface ProfessionalFormProps {
  professional?: Professional
}

export function ProfessionalForm({ professional }: ProfessionalFormProps) {
  const router = useRouter()
  const { createProfessional, updateProfessional } = useProfessionals()
  const isEdit = !!professional

  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: professional?.full_name ?? '',
    email: professional?.email ?? '',
    phone: professional?.phone ?? '',
    specialty: professional?.specialty ?? '',
    notes: professional?.notes ?? '',
    active: professional?.active ?? true,
  })

  function updateField(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.full_name.trim()) {
      toast.error('Nome e obrigatorio.')
      return
    }
    if (form.phone && !validatePhone(form.phone)) {
      toast.error('Telefone invalido. Use o formato (XX) 9XXXX-XXXX.')
      return
    }

    const payload: Partial<Professional> = {
      full_name: form.full_name.trim(),
      email: form.email || null,
      phone: form.phone || null,
      specialty: form.specialty || null,
      notes: form.notes || null,
      active: form.active,
    }

    setSaving(true)
    if (isEdit) {
      const { error } = await updateProfessional(professional.id, payload)
      setSaving(false)
      if (error) {
        toast.error('Erro ao atualizar profissional.')
      } else {
        toast.success('Profissional atualizado!')
      }
    } else {
      const { data, error } = await createProfessional(payload)
      if (error) {
        setSaving(false)
        toast.error('Erro ao criar profissional.')
        return
      }

      // Create auth user for the professional
      if (data && form.email) {
        try {
          const res = await fetch('/api/professionals/create-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: form.email,
              professionalId: data.id,
            }),
          })
          if (!res.ok) {
            const result = await res.json()
            toast.error(result.error || 'Erro ao criar usuario de acesso.')
          }
        } catch {
          toast.error('Erro ao criar usuario de acesso.')
        }
      }

      setSaving(false)
      toast.success('Profissional criado com sucesso!')
      router.push('/profissionais')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dados do Profissional</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
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
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={e => updateField('email', e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={e => updateField('phone', formatPhone(e.target.value))}
              placeholder="(21) 99999-9999"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="specialty">Especialidade</Label>
            <Input
              id="specialty"
              value={form.specialty}
              onChange={e => updateField('specialty', e.target.value)}
              placeholder="Ex: Fisioterapia, Quiropraxia"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Observacoes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={e => updateField('notes', e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.active}
              onCheckedChange={checked => updateField('active', checked)}
            />
            <Label>Ativo</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Salvando...' : isEdit ? 'Salvar Alteracoes' : 'Cadastrar Profissional'}
        </Button>
      </div>
    </form>
  )
}

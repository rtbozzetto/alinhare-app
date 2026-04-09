'use client'

import { useEffect, useState } from 'react'
import { useTreatmentPlans } from '@/hooks/use-treatment-plans'
import { useProfessionals } from '@/hooks/use-professionals'
import { useUserRole } from '@/hooks/use-user-role'
import { usePriceTables, type ProtocolKey } from '@/hooks/use-price-tables'
import { type TreatmentPlan } from '@/types/database'
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
import { PAYMENT_STATUSES, PAYMENT_METHODS, LEAD_SOURCES } from '@/lib/constants'
import { formatCurrency, calculateCommission, applyCreditCardFee } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'

interface TreatmentPlansTabProps {
  patientId: string
}

export function TreatmentPlansTab({ patientId }: TreatmentPlansTabProps) {
  const { plans, loading, fetchPlans, createPlan, deletePlan } = useTreatmentPlans(patientId)
  const { activeProfessionals } = useProfessionals()
  const { professionalId, isAdmin } = useUserRole()
  const { grouped, getEvaluationPrice, getPlanOptions } = usePriceTables()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    professional_id: professionalId ?? '',
    plan_type: 'treatment' as TreatmentPlan['plan_type'],
    protocol: 'janaina' as ProtocolKey,
    selected_price_id: '',
    plan_name: '',
    total_sessions: 1,
    start_date: new Date().toISOString().split('T')[0],
    notes: '',
    price: 0,
    payment_status: 'nao_pago' as TreatmentPlan['payment_status'],
    payment_method: 'pix' as TreatmentPlan['payment_method'],
    discount_amount: 0,
    discount_type: 'value' as TreatmentPlan['discount_type'],
    lead_source: 'clinica' as TreatmentPlan['lead_source'],
    lead_professional_id: null as string | null,
  })

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  function updateField(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleProtocolChange(proto: string) {
    updateField('protocol', proto)
    updateField('selected_price_id', '')
    updateField('plan_name', '')
    updateField('total_sessions', 1)
    updateField('price', 0)
  }

  function handlePlanTypeChange(type: string) {
    updateField('plan_type', type)
    updateField('selected_price_id', '')
    updateField('plan_name', '')
    updateField('total_sessions', 1)
    updateField('price', 0)
  }

  function handlePriceOptionChange(priceId: string) {
    updateField('selected_price_id', priceId)
    const options = getPlanOptions(form.protocol, form.plan_type as 'treatment' | 'maintenance')
    const option = options.find(o => o.id === priceId)
    if (option) {
      updateField('plan_name', option.plan_name)
      updateField('total_sessions', option.sessions)
      updateField('price', option.price)
    }
  }

  const discountValue =
    form.discount_type === 'percent'
      ? (form.price * form.discount_amount) / 100
      : form.discount_amount
  const afterDiscount = Math.max(0, form.price - discountValue)
  const finalAmount = form.payment_method === 'cartao' ? applyCreditCardFee(afterDiscount) : afterDiscount
  const selectedProfessionalName = activeProfessionals.find(p => p.id === form.professional_id)?.full_name
  const commission = calculateCommission(finalAmount, form.lead_source, selectedProfessionalName)

  function openCreateDialog() {
    setForm({
      professional_id: professionalId ?? '',
      plan_type: 'treatment',
      protocol: 'janaina',
      selected_price_id: '',
      plan_name: '',
      total_sessions: 1,
      start_date: new Date().toISOString().split('T')[0],
      notes: '',
      price: 0,
      payment_status: 'nao_pago',
      payment_method: 'pix',
      discount_amount: 0,
      discount_type: 'value',
      lead_source: 'clinica',
      lead_professional_id: null,
    })
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.professional_id) {
      toast.error('Selecione um profissional.')
      return
    }
    if (!form.plan_name.trim()) {
      toast.error('Selecione um plano.')
      return
    }

    setSaving(true)
    const { error } = await createPlan({
      patient_id: patientId,
      professional_id: form.professional_id,
      plan_name: form.plan_name,
      plan_type: form.plan_type,
      total_sessions: form.total_sessions,
      start_date: form.start_date,
      notes: form.notes || null,
      active: true,
      price: form.price,
      payment_status: form.payment_status,
      payment_method: form.payment_method,
      discount_type: form.discount_type,
      discount_amount: form.discount_amount,
      final_paid_amount: finalAmount,
      lead_source: form.lead_source,
      lead_professional_id: form.lead_professional_id,
      commission_percentage: commission.professionalPercent,
      commission_amount: commission.professionalAmount,
      clinic_amount: commission.clinicAmount,
    })
    setSaving(false)

    if (error) {
      toast.error('Erro ao criar plano.')
    } else {
      toast.success('Plano criado e sessoes geradas!')
      setDialogOpen(false)
      fetchPlans()
    }
  }

  async function handleDeletePlan(planId: string) {
    const { error } = await deletePlan(planId)
    if (error) {
      toast.error('Erro ao excluir plano.')
    } else {
      toast.success('Plano excluido.')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    )
  }

  const planTypeOptions = getPlanOptions(form.protocol, form.plan_type as 'treatment' | 'maintenance')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Planos de Tratamento</h2>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Plano
        </Button>
      </div>

      {plans.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          Nenhum plano cadastrado.
        </div>
      ) : (
        <div className="grid gap-3">
          {plans.map(plan => {
            const statusLabel = PAYMENT_STATUSES.find(s => s.value === plan.payment_status)?.label ?? plan.payment_status
            return (
              <Card key={plan.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{plan.plan_name}</span>
                      <Badge variant={plan.active ? 'default' : 'secondary'}>
                        {plan.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Badge variant="outline">{statusLabel}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {plan.total_sessions} sessoes - {formatCurrency(plan.price)}
                      {plan.discount_amount > 0 && ` (desc: ${formatCurrency(plan.discount_amount)})`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Liquido: {formatCurrency(plan.final_paid_amount)} | Repasse: {formatCurrency(plan.commission_amount)} | Clinica: {formatCurrency(plan.clinic_amount)}
                    </p>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeletePlan(plan.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Plan Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Plano de Tratamento</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Profissional *</Label>
                <Select
                  value={form.professional_id}
                  onValueChange={(value: string) => updateField('professional_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeProfessionals.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Protocolo</Label>
                <Select
                  value={form.protocol}
                  onValueChange={(value: string) => handleProtocolChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="janaina">{grouped.janaina.label}</SelectItem>
                    <SelectItem value="quiropraxistas">{grouped.quiropraxistas.label}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.plan_type}
                  onValueChange={(value: string) => handlePlanTypeChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="treatment">Tratamento</SelectItem>
                    <SelectItem value="maintenance">Manutencao</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Plano *</Label>
                <Select
                  value={form.selected_price_id}
                  onValueChange={(value: string) => handlePriceOptionChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um plano..." />
                  </SelectTrigger>
                  <SelectContent>
                    {planTypeOptions.map(opt => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.plan_name} - {opt.sessions} sess. - {formatCurrency(opt.price)}
                        {opt.recommended ? ' (Recomendado)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data de inicio</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={e => updateField('start_date', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Sessoes</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.total_sessions}
                  onChange={e => updateField('total_sessions', parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observacoes</Label>
              <Textarea
                value={form.notes}
                onChange={e => updateField('notes', e.target.value)}
                rows={2}
              />
            </div>

            {/* Payment */}
            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="font-medium">Pagamento</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.payment_status}
                    onValueChange={(value: string) => updateField('payment_status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUSES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Metodo</Label>
                  <Select
                    value={form.payment_method}
                    onValueChange={(value: string) => updateField('payment_method', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={e => updateField('price', parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Desconto ({form.discount_type === 'percent' ? '%' : 'R$'})</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.discount_amount}
                      onChange={e => updateField('discount_amount', parseFloat(e.target.value) || 0)}
                      className="flex-1"
                    />
                    <Select
                      value={form.discount_type}
                      onValueChange={(value: string) => updateField('discount_type', value)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="value">R$</SelectItem>
                        <SelectItem value="percent">%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Origem do Lead</Label>
                  <Select
                    value={form.lead_source}
                    onValueChange={(value: string) => updateField('lead_source', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_SOURCES.map(l => (
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {form.lead_source === 'profissional' && (
                  <div className="space-y-2">
                    <Label>Profissional responsavel</Label>
                    <Select
                      value={form.lead_professional_id ?? ''}
                      onValueChange={(value: string) => updateField('lead_professional_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {activeProfessionals.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="mt-3 rounded-md bg-gray-50 p-3 text-sm">
                <div className="flex justify-between">
                  <span>Valor bruto:</span>
                  <span>{formatCurrency(form.price)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Desconto:</span>
                  <span>- {formatCurrency(discountValue)}</span>
                </div>
                {form.payment_method === 'cartao' && (
                  <div className="flex justify-between text-orange-600">
                    <span>Taxa cartao (5,99%):</span>
                    <span>- {formatCurrency(afterDiscount - finalAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-medium text-teal-600">
                  <span>Valor liquido:</span>
                  <span>{formatCurrency(finalAmount)}</span>
                </div>
                <div className="mt-1 border-t pt-1 flex justify-between">
                  <span>Repasse ({commission.professionalPercent}%):</span>
                  <span>{formatCurrency(commission.professionalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Clinica ({commission.clinicPercent}%):</span>
                  <span>{formatCurrency(commission.clinicAmount)}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={saving}>
                {saving ? 'Salvando...' : 'Criar Plano'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

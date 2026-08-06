'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { format, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { usePartnerCompanies } from '@/hooks/use-partner-companies'
import { AdminGuard } from '@/components/layout/admin-guard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Trash2, Undo2, Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

export default function ParceriasPage() {
  return (
    <AdminGuard>
      <ParceriasContent />
    </AdminGuard>
  )
}

interface LeadSummary {
  midiaDigital: { patients: number; revenue: number }
  parceria: { patients: number; revenue: number }
  perCompany: { companyId: string; companyName: string; patients: number; revenue: number }[]
}

function ParceriasContent() {
  const { companies, activeCompanies, loading, createCompany, deactivateCompany, reactivateCompany } = usePartnerCompanies()
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [summary, setSummary] = useState<LeadSummary>({
    midiaDigital: { patients: 0, revenue: 0 },
    parceria: { patients: 0, revenue: 0 },
    perCompany: [],
  })
  const [loadingSummary, setLoadingSummary] = useState(false)

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth() + 1
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const companyMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const c of companies) m[c.id] = c.name
    return m
  }, [companies])

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true)
    const supabase = createClient()

    // Plans paid this month + appointments in this month, both with lead_source = 'clinica'
    const [plansRes, apptsRes] = await Promise.all([
      supabase
        .from('treatment_plans')
        .select('id, patient_id, final_paid_amount, lead_subtype, lead_company_id, payment_status')
        .eq('lead_source', 'clinica')
        .in('payment_status', ['pago', 'pago_pacote'])
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`),
      supabase
        .from('appointments')
        .select('id, patient_id, final_paid_amount, lead_subtype, lead_company_id, payment_status')
        .eq('lead_source', 'clinica')
        .gte('appointment_date', startDate)
        .lte('appointment_date', endDate)
        .neq('status', 'cancelada'),
    ])

    type Row = { patient_id: string; final_paid_amount: number; lead_subtype: string | null; lead_company_id: string | null; payment_status?: string }
    const plans: Row[] = plansRes.data ?? []
    const appts: Row[] = apptsRes.data ?? []

    // Avoid double-counting appointments whose parent plan is 'pago_pacote' (revenue is on the plan row)
    const paidPlanPatients = new Set(plans.filter(p => p.payment_status === 'pago_pacote').map(p => p.patient_id))
    const filteredAppts = appts.filter(a => !(a.payment_status === 'pago_pacote' && paidPlanPatients.has(a.patient_id)))

    const midiaPatients = new Set<string>()
    let midiaRevenue = 0
    const parceriaPatients = new Set<string>()
    let parceriaRevenue = 0
    const perCompanyMap: Record<string, { patients: Set<string>; revenue: number }> = {}

    const process = (row: Row) => {
      const amt = Number(row.final_paid_amount ?? 0)
      if (row.lead_subtype === 'midia_digital') {
        midiaPatients.add(row.patient_id)
        midiaRevenue += amt
      } else if (row.lead_subtype === 'parceria') {
        parceriaPatients.add(row.patient_id)
        parceriaRevenue += amt
        if (row.lead_company_id) {
          if (!perCompanyMap[row.lead_company_id]) {
            perCompanyMap[row.lead_company_id] = { patients: new Set(), revenue: 0 }
          }
          perCompanyMap[row.lead_company_id].patients.add(row.patient_id)
          perCompanyMap[row.lead_company_id].revenue += amt
        }
      }
    }

    plans.forEach(process)
    filteredAppts.forEach(process)

    const perCompany = Object.entries(perCompanyMap).map(([companyId, v]) => ({
      companyId,
      companyName: companyMap[companyId] ?? '(empresa removida)',
      patients: v.patients.size,
      revenue: v.revenue,
    })).sort((a, b) => b.revenue - a.revenue)

    setSummary({
      midiaDigital: { patients: midiaPatients.size, revenue: midiaRevenue },
      parceria: { patients: parceriaPatients.size, revenue: parceriaRevenue },
      perCompany,
    })
    setLoadingSummary(false)
  }, [startDate, endDate, companyMap])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) {
      toast.error('Informe o nome da empresa.')
      return
    }
    setSaving(true)
    const { error } = await createCompany(newName)
    setSaving(false)
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Empresa já cadastrada.' : 'Erro ao cadastrar empresa.')
    } else {
      toast.success('Empresa cadastrada!')
      setNewName('')
    }
  }

  async function handleDeactivate(id: string) {
    const { error } = await deactivateCompany(id)
    if (error) toast.error('Erro ao desativar empresa.')
    else toast.success('Empresa desativada.')
  }

  async function handleReactivate(id: string) {
    const { error } = await reactivateCompany(id)
    if (error) toast.error('Erro ao reativar empresa.')
    else toast.success('Empresa reativada.')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold">Parcerias</h1>

      {/* Empresas cadastradas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Empresas Parceiras</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Nome da empresa"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={saving} className="bg-teal-600 hover:bg-teal-700">
              <Plus className="mr-1 h-4 w-4" />
              Adicionar
            </Button>
          </form>

          {loading ? (
            <div className="flex justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
            </div>
          ) : companies.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhuma empresa cadastrada.</p>
          ) : (
            <div className="space-y-2">
              {companies.map(c => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <span className={c.active ? 'font-medium' : 'font-medium text-muted-foreground line-through'}>
                      {c.name}
                    </span>
                    {!c.active && <Badge variant="secondary" className="text-[10px]">Inativa</Badge>}
                  </div>
                  {c.active ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => handleDeactivate(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-teal-600" onClick={() => handleReactivate(c.id)}>
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo mensal */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Resumo Mensal por Origem</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[120px] text-center text-sm font-medium capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </span>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingSummary ? (
            <div className="flex justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryCard
                  title="Mídia Digital"
                  patients={summary.midiaDigital.patients}
                  revenue={summary.midiaDigital.revenue}
                />
                <SummaryCard
                  title="Parcerias (total)"
                  patients={summary.parceria.patients}
                  revenue={summary.parceria.revenue}
                />
              </div>

              {summary.perCompany.length > 0 && (
                <div className="pt-2">
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">Detalhamento por empresa</h3>
                  <div className="space-y-2">
                    {summary.perCompany.map(pc => (
                      <div key={pc.companyId} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                        <span className="font-medium">{pc.companyName}</span>
                        <div className="flex items-center gap-4 text-muted-foreground">
                          <span>{pc.patients} {pc.patients === 1 ? 'paciente' : 'pacientes'}</span>
                          <span className="font-medium text-teal-600">{formatCurrency(pc.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ title, patients, revenue }: { title: string; patients: number; revenue: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-2xl font-bold text-teal-600">{formatCurrency(revenue)}</p>
        <p className="text-sm text-muted-foreground">{patients} {patients === 1 ? 'paciente' : 'pacientes'}</p>
      </CardContent>
    </Card>
  )
}

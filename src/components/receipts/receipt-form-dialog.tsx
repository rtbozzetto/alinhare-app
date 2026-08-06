'use client'

import { useEffect, useState } from 'react'
import { useReceipts } from '@/hooks/use-receipts'
import { useClinicSettings } from '@/hooks/use-clinic-settings'
import { useUserRole } from '@/hooks/use-user-role'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { PAYMENT_METHODS } from '@/lib/constants'
import { buildReceiptPdfBlob, type ReceiptPdfData } from '@/lib/pdf'
import { getWhatsAppUrl } from '@/lib/utils'
import { toast } from 'sonner'
import { FileDown, MessageCircle, Save } from 'lucide-react'

interface ReceiptFormDialogProps {
  open: boolean
  onClose: () => void
  patientId?: string | null
  patientName?: string
  patientCpf?: string
  patientPhone?: string
  defaultAmount?: number
  defaultDescription?: string
  defaultPaymentMethod?: string
  onSaved?: () => void
}

export function ReceiptFormDialog({
  open,
  onClose,
  patientId,
  patientName,
  patientCpf,
  patientPhone,
  defaultAmount,
  defaultDescription,
  defaultPaymentMethod,
  onSaved,
}: ReceiptFormDialogProps) {
  const { createReceipt } = useReceipts()
  const { settings, signatureDataUrl } = useClinicSettings()
  const { professionalId } = useUserRole()

  const [payerName, setPayerName] = useState('')
  const [payerCpf, setPayerCpf] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('pix')
  const [description, setDescription] = useState('')
  const [issuedAt, setIssuedAt] = useState('')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setPayerName(patientName ?? '')
      setPayerCpf(patientCpf ?? '')
      setAmount(defaultAmount ? String(defaultAmount) : '')
      setDescription(defaultDescription ?? 'Serviço de quiropraxia')
      setPaymentMethod(defaultPaymentMethod ?? 'pix')
      const today = new Date().toISOString().split('T')[0]
      setIssuedAt(today)
      setCity(settings?.emitter_city ?? '')
    }
  }, [open, patientName, patientCpf, defaultAmount, defaultDescription, defaultPaymentMethod, settings])

  function buildPdfData(): ReceiptPdfData | null {
    const amt = parseFloat(amount)
    if (!payerName.trim()) { toast.error('Informe o nome do pagador.'); return null }
    if (!payerCpf.trim()) { toast.error('Informe o CPF do pagador.'); return null }
    if (isNaN(amt) || amt <= 0) { toast.error('Informe um valor válido.'); return null }
    if (!description.trim()) { toast.error('Informe a descrição do serviço.'); return null }
    if (!issuedAt) { toast.error('Informe a data.'); return null }
    if (!settings?.emitter_name || !settings?.emitter_document) {
      toast.error('Configure os dados do emissor em Configurações.')
      return null
    }
    const methodLabel = PAYMENT_METHODS.find(m => m.value === paymentMethod)?.label ?? paymentMethod
    return {
      payerName: payerName.trim(),
      payerCpf: payerCpf.trim(),
      amount: amt,
      paymentMethod: methodLabel,
      description: description.trim(),
      issuedAt,
      city: city.trim() || settings.emitter_city || '',
      emitterName: settings.emitter_name,
      emitterDocument: settings.emitter_document,
      emitterAddress: settings.emitter_address ?? undefined,
      emitterCity: settings.emitter_city ?? undefined,
      signatureDataUrl,
    }
  }

  async function saveReceiptRecord(): Promise<boolean> {
    const amt = parseFloat(amount)
    setSaving(true)
    const { error } = await createReceipt({
      patient_id: patientId ?? null,
      professional_id: professionalId ?? null,
      payer_name: payerName.trim(),
      payer_cpf: payerCpf.replace(/\D/g, ''),
      amount: amt,
      payment_method: paymentMethod,
      description: description.trim(),
      issued_at: issuedAt,
      city: city.trim() || null,
      notes: null,
    })
    setSaving(false)
    if (error) {
      toast.error('Erro ao salvar recibo no histórico.')
      return false
    }
    onSaved?.()
    return true
  }

  async function handleDownload() {
    const data = buildPdfData()
    if (!data) return
    const ok = await saveReceiptRecord()
    if (!ok) return
    const blob = buildReceiptPdfBlob(data)
    const url = URL.createObjectURL(blob)
    const filename = `recibo-${data.payerName.replace(/\s/g, '_')}-${data.issuedAt}.pdf`
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Recibo gerado!')
    onClose()
  }

  async function handleWhatsApp() {
    const data = buildPdfData()
    if (!data) return
    if (!patientPhone) {
      toast.error('Paciente sem telefone. Baixe o PDF e envie manualmente.')
      return
    }
    const ok = await saveReceiptRecord()
    if (!ok) return

    // Trigger PDF download so user can attach in WhatsApp
    const blob = buildReceiptPdfBlob(data)
    const url = URL.createObjectURL(blob)
    const filename = `recibo-${data.payerName.replace(/\s/g, '_')}-${data.issuedAt}.pdf`
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    // Open WhatsApp with prepared message
    const msg = `Olá, ${data.payerName.split(' ')[0]}! Segue o recibo referente ao pagamento de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.amount)}. Qualquer dúvida, estamos à disposição. 🙏`
    window.open(getWhatsAppUrl(patientPhone, msg), '_blank')
    toast.success('PDF baixado! Anexe no WhatsApp que abriu.')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Recibo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do pagador</Label>
            <Input value={payerName} onChange={e => setPayerName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>CPF do pagador</Label>
            <Input value={payerCpf} onChange={e => setPayerCpf(e.target.value)} placeholder="000.000.000-00" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição do serviço</Label>
            <Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={issuedAt} onChange={e => setIssuedAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={city} onChange={e => setCity(e.target.value)} />
            </div>
          </div>

          {(!settings?.emitter_name || !settings?.emitter_document) && (
            <p className="rounded-md border border-orange-300 bg-orange-50 p-2 text-xs text-orange-800">
              ⚠ Configure os dados do emissor (nome, CPF) em Configurações antes de gerar recibos.
            </p>
          )}
          {!signatureDataUrl && (
            <p className="rounded-md border border-orange-200 bg-orange-50 p-2 text-xs text-orange-800">
              ⚠ Assinatura não carregada. Verifique em Configurações.
            </p>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="outline" onClick={handleDownload} disabled={saving}>
            <FileDown className="mr-2 h-4 w-4" />
            Baixar PDF
          </Button>
          {patientPhone && (
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleWhatsApp} disabled={saving}>
              <MessageCircle className="mr-2 h-4 w-4" />
              PDF + WhatsApp
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

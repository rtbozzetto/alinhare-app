import jsPDF from 'jspdf'
import { CLINIC_INFO, APPOINTMENT_TYPES, PAYMENT_STATUSES } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import { numberToWordsBR } from '@/lib/number-to-words'
import { type Appointment } from '@/types/database'
import { type BillingPlanRow, type BillingSessionRow } from '@/hooks/use-billing'

interface BillingRow {
  date: string
  patient: string
  type: string
  session: string
  valor: number
  desconto: number
  liquido: number
  comissao: number
  clinica: number
  pagamento: string
}

function getPaymentLabel(status: string): string {
  return PAYMENT_STATUSES.find(s => s.value === status)?.label ?? status
}

function getTypeLabel(type: string): string {
  return APPOINTMENT_TYPES.find(t => t.value === type)?.label ?? type
}

export function generateBillingPdf(
  appointments: Appointment[],
  paidPlans: BillingPlanRow[],
  completedSessions: BillingSessionRow[],
  professionalName: string,
  referenceMonth: string,
  totals: {
    bruto: number
    desconto: number
    liquido: number
    repasse: number
    clinica: number
  }
) {
  const doc = new jsPDF('landscape', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Header
  doc.setFontSize(16)
  doc.setTextColor(...CLINIC_INFO.brandColor)
  doc.text(CLINIC_INFO.fullName, 14, 20)
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(CLINIC_INFO.address, 14, 28)
  doc.text(`Tel: ${CLINIC_INFO.phone} | Instagram: ${CLINIC_INFO.instagram}`, 14, 34)

  // Title
  doc.setFontSize(14)
  doc.setTextColor(0, 0, 0)
  const monthLabel = new Date(referenceMonth + '-15').toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
  doc.text(`Relatório de Faturamento — ${professionalName}`, 14, 48)
  doc.text(`Mês: ${monthLabel}`, 14, 56)

  // Summary row
  doc.setFontSize(10)
  const summaryY = 66
  doc.text(`Bruto: ${formatCurrency(totals.bruto)}`, 14, summaryY)
  doc.text(`Desconto: ${formatCurrency(totals.desconto)}`, 80, summaryY)
  doc.text(`Líquido: ${formatCurrency(totals.liquido)}`, 146, summaryY)
  doc.text(`Repasse: ${formatCurrency(totals.repasse)}`, 212, summaryY)

  // Build unified rows
  const rows: BillingRow[] = []

  // Paid plans
  for (const plan of paidPlans) {
    rows.push({
      date: new Date(plan.created_at).toLocaleDateString('pt-BR'),
      patient: plan.patient_name,
      type: `[Plano] ${plan.plan_name}`,
      session: '—',
      valor: plan.price,
      desconto: plan.discount_amount,
      liquido: plan.final_paid_amount,
      comissao: plan.commission_amount,
      clinica: plan.clinic_amount,
      pagamento: getPaymentLabel(plan.payment_status),
    })
  }

  // Completed sessions without appointment
  for (const sess of completedSessions) {
    rows.push({
      date: new Date(sess.session_date + 'T12:00:00').toLocaleDateString('pt-BR'),
      patient: sess.patient_name,
      type: `[Sessão] ${sess.plan_name}`,
      session: `${sess.session_number} de ${sess.total_sessions}`,
      valor: sess.price,
      desconto: sess.discount_amount,
      liquido: sess.final_paid_amount,
      comissao: sess.commission_amount,
      clinica: sess.clinic_amount,
      pagamento: getPaymentLabel(sess.payment_status),
    })
  }

  // Appointments
  for (const appt of appointments) {
    const planName = (appt as any)._plan_name
    const sessionNum = (appt as any)._session_number
    const totalSess = (appt as any)._total_sessions
    rows.push({
      date: new Date(appt.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR'),
      patient: appt.patient?.full_name ?? '-',
      type: planName ?? getTypeLabel(appt.appointment_type),
      session: sessionNum ? `${sessionNum} de ${totalSess}` : '—',
      valor: appt.custom_price ?? 0,
      desconto: appt.discount_amount,
      liquido: appt.final_paid_amount,
      comissao: appt.commission_amount,
      clinica: appt.clinic_amount,
      pagamento: getPaymentLabel(appt.payment_status),
    })
  }

  // Table header
  const tableY = 78
  doc.setFillColor(240, 240, 240)
  doc.rect(14, tableY - 5, pageWidth - 28, 8, 'F')

  doc.setFontSize(8)
  doc.setTextColor(0, 0, 0)
  const cols = ['Data', 'Paciente', 'Tipo', 'Sessão', 'Valor', 'Desconto', 'Líquido', 'Comissão', 'Clínica', 'Pagamento']
  const colX = [14, 36, 78, 128, 148, 170, 192, 214, 236, 258]
  cols.forEach((col, i) => doc.text(col, colX[i], tableY))

  // Table rows
  let y = tableY + 8
  for (const row of rows) {
    if (y > pageHeight - 20) {
      doc.addPage()
      y = 20
      // Re-draw header on new page
      doc.setFillColor(240, 240, 240)
      doc.rect(14, y - 5, pageWidth - 28, 8, 'F')
      doc.setFontSize(8)
      doc.setTextColor(0, 0, 0)
      cols.forEach((col, i) => doc.text(col, colX[i], y))
      y += 8
    }
    doc.setFontSize(7)
    doc.setTextColor(0, 0, 0)
    doc.text(row.date, colX[0], y)
    doc.text(row.patient.slice(0, 22), colX[1], y)
    doc.text(row.type.slice(0, 28), colX[2], y)
    doc.text(row.session, colX[3], y)
    doc.text(formatCurrency(row.valor), colX[4], y)
    doc.text(formatCurrency(row.desconto), colX[5], y)
    doc.text(formatCurrency(row.liquido), colX[6], y)
    doc.text(formatCurrency(row.comissao), colX[7], y)
    doc.text(formatCurrency(row.clinica), colX[8], y)
    doc.text(row.pagamento, colX[9], y)
    y += 6
  }

  // Totals line
  y += 4
  if (y > pageHeight - 20) {
    doc.addPage()
    y = 20
  }
  doc.setDrawColor(200, 200, 200)
  doc.line(14, y - 3, pageWidth - 14, y - 3)
  doc.setFontSize(8)
  doc.setFont(undefined!, 'bold')
  doc.text('TOTAL', colX[0], y)
  doc.text(formatCurrency(totals.bruto), colX[4], y)
  doc.text(formatCurrency(totals.desconto), colX[5], y)
  doc.text(formatCurrency(totals.liquido), colX[6], y)
  doc.text(formatCurrency(totals.repasse), colX[7], y)
  doc.text(formatCurrency(totals.clinica), colX[8], y)
  doc.setFont(undefined!, 'normal')

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text(
    `Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
    14,
    pageHeight - 10
  )

  doc.save(`faturamento-${professionalName.replace(/\s/g, '_')}-${referenceMonth}.pdf`)
}

// ═══════════════════════════════════════════════════════════════
// RECIBO
// ═══════════════════════════════════════════════════════════════

export interface ReceiptPdfData {
  payerName: string
  payerCpf: string
  amount: number
  paymentMethod: string
  description: string
  issuedAt: string // YYYY-MM-DD
  city: string
  emitterName: string
  emitterDocument: string
  emitterAddress?: string
  emitterCity?: string
  signatureDataUrl?: string | null
}

function formatCpfCnpj(v: string): string {
  const d = (v || '').replace(/\D/g, '')
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`
  return v
}

function formatDatePtBR(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

/**
 * Retorna o Blob do PDF (não salva). Use para preview ou envio.
 */
export function buildReceiptPdfBlob(data: ReceiptPdfData): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.width
  const marginX = 20
  const contentWidth = pageWidth - marginX * 2
  let y = 30

  // Título
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('RECIBO', pageWidth / 2, y, { align: 'center' })

  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.text(`Valor: ${formatCurrency(data.amount)}`, pageWidth / 2, y, { align: 'center' })

  y += 15

  // Corpo do recibo
  doc.setFontSize(11)
  const valorExtenso = numberToWordsBR(data.amount)
  const body =
    `Recebi de ${data.payerName}, CPF ${formatCpfCnpj(data.payerCpf)}, ` +
    `a importância de ${formatCurrency(data.amount)} (${valorExtenso}), ` +
    `referente a ${data.description}. ` +
    `Forma de pagamento: ${data.paymentMethod}. ` +
    `Para maior clareza, firmo o presente recibo.`

  const lines = doc.splitTextToSize(body, contentWidth)
  doc.text(lines, marginX, y, { align: 'justify', maxWidth: contentWidth })
  y += lines.length * 6 + 10

  // Local e data
  doc.text(`${data.city || data.emitterCity || 'São Paulo'}, ${formatDatePtBR(data.issuedAt)}.`, marginX, y)
  y += 30

  // Assinatura
  const signX = marginX + contentWidth / 2
  if (data.signatureDataUrl) {
    try {
      // Assinatura: 60mm x 22mm centralizada
      doc.addImage(data.signatureDataUrl, 'PNG', signX - 30, y - 22, 60, 22)
    } catch (err) {
      console.error('Signature draw error:', err)
    }
  }
  // Linha da assinatura
  doc.setLineWidth(0.3)
  doc.line(signX - 40, y, signX + 40, y)
  y += 5
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(data.emitterName, signX, y, { align: 'center' })
  y += 5
  doc.setFont('helvetica', 'normal')
  if (data.emitterDocument) {
    doc.text(`CPF: ${formatCpfCnpj(data.emitterDocument)}`, signX, y, { align: 'center' })
    y += 5
  }
  if (data.emitterAddress) {
    doc.setFontSize(9)
    doc.text(data.emitterAddress, signX, y, { align: 'center' })
  }

  return doc.output('blob')
}

export function generateReceiptPdf(data: ReceiptPdfData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  // Rebuild inline (jsPDF.save uses instance state)
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
  // unused doc silences linter
  void doc
}


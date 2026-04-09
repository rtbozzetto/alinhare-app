import jsPDF from 'jspdf'
import { CLINIC_INFO } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import { type Appointment } from '@/types/database'

export function generateBillingPdf(
  appointments: Appointment[],
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

  // Table header background
  const tableY = 78
  doc.setFillColor(240, 240, 240)
  doc.rect(14, tableY - 5, pageWidth - 28, 8, 'F')

  doc.setFontSize(8)
  doc.setTextColor(0, 0, 0)
  const cols = ['Data', 'Paciente', 'Tipo', 'Valor', 'Desconto', 'Líquido', 'Comissão', 'Clínica', 'Pagamento']
  const colX = [14, 40, 100, 135, 160, 185, 210, 235, 260]
  cols.forEach((col, i) => doc.text(col, colX[i], tableY))

  // Table rows
  let y = tableY + 8
  appointments.forEach(appt => {
    if (y > 180) {
      doc.addPage()
      y = 20
    }
    doc.text(
      new Date(appt.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR'),
      colX[0],
      y
    )
    doc.text((appt.patient?.full_name ?? '').slice(0, 20), colX[1], y)
    doc.text(appt.appointment_type, colX[2], y)
    doc.text(formatCurrency(appt.custom_price ?? 0), colX[3], y)
    doc.text(formatCurrency(appt.discount_amount), colX[4], y)
    doc.text(formatCurrency(appt.final_paid_amount), colX[5], y)
    doc.text(formatCurrency(appt.commission_amount), colX[6], y)
    doc.text(formatCurrency(appt.clinic_amount), colX[7], y)
    doc.text(appt.payment_status, colX[8], y)
    y += 6
  })

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text(
    `Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
    14,
    doc.internal.pageSize.getHeight() - 10
  )

  doc.save(`faturamento-${professionalName.replace(/\s/g, '_')}-${referenceMonth}.pdf`)
}

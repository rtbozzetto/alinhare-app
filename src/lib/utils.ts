import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function validatePhone(phone: string): boolean {
  return /^\(\d{2}\) 9\d{4}-\d{4}$/.test(phone)
}

export function parseHeight(value: string): number | null {
  const normalized = value.replace(',', '.')
  const num = parseFloat(normalized)
  if (isNaN(num) || num <= 0 || num > 3) return null
  return num
}

export function formatHeight(value: number | null): string {
  if (!value) return ''
  return value.toFixed(2).replace('.', ',')
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function calculateAge(birthDate: string | Date): number {
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

export function calculateCommission(
  amount: number,
  leadSource: 'clinica' | 'profissional',
  professionalName?: string
): { professionalPercent: number; clinicPercent: number; professionalAmount: number; clinicAmount: number } {
  let professionalPercent: number
  let clinicPercent: number

  if (leadSource === 'clinica') {
    // Lead da clínica: clínica 60%, profissional 40%
    clinicPercent = 60
    professionalPercent = 40
  } else {
    // Lead do profissional: clínica 40%, profissional 60%
    // Exceção: Janaína com lead próprio → clínica 0%, ela 100%
    const isJanaina = professionalName?.toLowerCase().includes('janaina') ||
                      professionalName?.toLowerCase().includes('janaína')
    if (isJanaina) {
      clinicPercent = 0
      professionalPercent = 100
    } else {
      clinicPercent = 40
      professionalPercent = 60
    }
  }

  return {
    professionalPercent,
    clinicPercent,
    professionalAmount: (amount * professionalPercent) / 100,
    clinicAmount: (amount * clinicPercent) / 100,
  }
}

export function applyCreditCardFee(amount: number): number {
  return amount * (1 - 5.99 / 100)
}

export function formatWhatsAppMessage(
  patientName: string,
  date: string,
  time: string,
  professionalName: string
): string {
  return `Olá, ${patientName}. Tudo bem?\nSua consulta na Alinhare está agendada para ${date} às ${time} com ${professionalName}.\nQualquer dúvida, estamos à disposição.`
}

export function getWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '')
  const fullNumber = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${fullNumber}?text=${encodeURIComponent(message)}`
}

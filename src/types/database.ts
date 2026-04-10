export type AppRole = 'admin' | 'profissional'

export interface Professional {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  specialty: string | null
  notes: string | null
  active: boolean
  auth_user_id: string | null
  created_at: string
  updated_at: string
}

export interface Patient {
  id: string
  full_name: string
  birth_date: string | null
  sex: 'masculino' | 'feminino' | 'outro'
  height_cm: number | null
  phone: string | null
  email: string | null
  cpf: string | null
  address: string | null
  sport: string | null
  surgery_history: string | null
  medication: string | null
  health_problems: string | null
  main_complaint: string | null
  general_notes: string | null
  discomfort_regions: string[] | null
  discomfort_intensities: Record<string, number> | null
  discomfort_frequency: string | null
  discomfort_duration: string | null
  created_at: string
  updated_at: string
}

export interface ProfessionalPatient {
  professional_id: string
  patient_id: string
  created_at: string
}

export interface TreatmentPlan {
  id: string
  patient_id: string
  professional_id: string
  plan_name: string
  plan_type: 'treatment' | 'maintenance' | 'avaliacao'
  total_sessions: number
  start_date: string
  notes: string | null
  active: boolean
  price: number
  payment_status: 'pago' | 'nao_pago' | 'pago_pacote'
  payment_method: 'dinheiro' | 'pix' | 'cartao'
  discount_type: 'value' | 'percent'
  discount_amount: number
  final_paid_amount: number
  lead_source: 'clinica' | 'profissional'
  lead_professional_id: string | null
  commission_percentage: number
  commission_amount: number
  clinic_amount: number
  created_at: string
  updated_at: string
}

export interface TreatmentSession {
  id: string
  plan_id: string
  patient_id: string
  professional_id: string
  session_number: number
  session_date: string
  notes: string | null
  completed: boolean
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: string
  patient_id: string
  professional_id: string
  appointment_date: string
  appointment_time: string
  appointment_type: 'avaliacao' | 'tratamento' | 'manutencao' | 'sessao' | 'retorno'
  notes: string | null
  status: 'agendada' | 'confirmada' | 'cancelada' | 'realizada'
  session_id: string | null
  payment_status: 'pago' | 'nao_pago' | 'pago_pacote'
  price_option: string | null
  custom_price: number | null
  discount_amount: number
  discount_type: 'value' | 'percent'
  final_paid_amount: number
  lead_source: 'clinica' | 'profissional'
  lead_professional_id: string | null
  payment_method: 'dinheiro' | 'pix' | 'cartao'
  commission_percentage: number
  commission_amount: number
  clinic_amount: number
  created_at: string
  updated_at: string
  // Join fields
  patient?: Pick<Patient, 'full_name'>
  professional?: Pick<Professional, 'id' | 'full_name'>
}

export interface PatientPhoto {
  id: string
  session_id: string
  patient_id: string
  photo_type: 'frente' | 'costas' | 'lateral_direita' | 'lateral_esquerda'
  photo_url: string
  created_at: string
}

export interface PatientExam {
  id: string
  patient_id: string
  file_name: string
  file_url: string
  file_type: string
  exam_description: string | null
  ai_analysis: string | null
  analyzed_at: string | null
  created_at: string
}

export interface ClinicalNote {
  id: string
  session_id: string | null
  patient_id: string
  note_text: string
  created_at: string
}

export interface DiscomfortRecord {
  id: string
  session_id: string
  patient_id: string
  body_region: string
  pain_intensity: number
  notes: string | null
  created_at: string
}

export interface PostureAnalysis {
  id: string
  patient_id: string
  session_a_id: string | null
  session_b_id: string | null
  analysis_text: string
  analysis_type: 'single' | 'compare'
  created_at: string
}

export interface PatientEditHistory {
  id: string
  patient_id: string
  snapshot: Record<string, unknown>
  edit_summary: string | null
  edited_at: string
}

export interface Notification {
  id: string
  recipient_professional_id: string | null
  recipient_admin: boolean
  title: string
  message: string
  type: 'appointment' | 'system'
  related_appointment_id: string | null
  read: boolean
  created_at: string
}

export interface MonthlyClosing {
  id: string
  reference_month: string
  status: 'aberto' | 'fechado'
  total_bruto: number
  total_desconto: number
  total_liquido: number
  total_repasse: number
  total_clinica: number
  total_appointments: number
  snapshot: unknown[]
  closed_at: string | null
  reopened_at: string | null
  created_at: string
  updated_at: string
}

export interface UserRole {
  id: string
  user_id: string
  role: AppRole
  created_at: string
}

export interface PriceProtocol {
  id: string
  protocol_key: 'janaina' | 'quiropraxistas'
  protocol_label: string
  category: 'treatment' | 'maintenance' | 'evaluation'
  plan_name: string
  sessions: number
  price: number
  recommended: boolean
  sort_order: number
  active: boolean
  updated_at: string
  created_at: string
}

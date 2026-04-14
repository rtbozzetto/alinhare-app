// Appointment types
export const APPOINTMENT_TYPES = [
  { value: 'avaliacao', label: 'Avaliação' },
  { value: 'tratamento', label: 'Tratamento' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'sessao', label: 'Sessão' },
  { value: 'retorno', label: 'Retorno' },
] as const

// Appointment statuses
export const APPOINTMENT_STATUSES = [
  { value: 'agendada', label: 'Agendada', color: 'blue' },
  { value: 'confirmada', label: 'Confirmada', color: 'green' },
  { value: 'cancelada', label: 'Cancelada', color: 'red' },
  { value: 'realizada', label: 'Realizada', color: 'gray' },
] as const

// Payment statuses
export const PAYMENT_STATUSES = [
  { value: 'pago', label: 'Pago' },
  { value: 'nao_pago', label: 'Não Pago' },
  { value: 'pago_pacote', label: 'Pago no Pacote' },
] as const

// Payment methods
export const PAYMENT_METHODS = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'cartao', label: 'Cartão' },
] as const

// Lead sources
export const LEAD_SOURCES = [
  { value: 'clinica', label: 'Clínica' },
  { value: 'profissional', label: 'Profissional' },
] as const

// Sex options
export const SEX_OPTIONS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'feminino', label: 'Feminino' },
  { value: 'outro', label: 'Outro' },
] as const

// Photo types
export const PHOTO_TYPES = [
  { value: 'frente', label: 'Frente' },
  { value: 'costas', label: 'Costas' },
  { value: 'lateral_direita', label: 'Lateral D' },
  { value: 'lateral_esquerda', label: 'Lateral E' },
] as const

// Posture analysis types
export const ANALYSIS_TYPES = [
  { value: 'single', label: 'Análise Individual' },
  { value: 'compare', label: 'Análise Comparativa' },
] as const

// Discomfort frequency options
export const DISCOMFORT_FREQUENCIES = [
  'Constante',
  'Diário',
  'Algumas vezes por semana',
  'Semanal',
  'Quinzenal',
  'Mensal',
  'Esporádico',
] as const

// Body regions for discomfort
export const BODY_REGIONS = [
  'Cervical', 'Torácica', 'Lombar', 'Sacral',
  'Ombro D', 'Ombro E', 'Cotovelo D', 'Cotovelo E',
  'Punho D', 'Punho E', 'Quadril D', 'Quadril E',
  'Joelho D', 'Joelho E', 'Tornozelo D', 'Tornozelo E',
  'Cabeça', 'ATM', 'Pé D', 'Pé E',
] as const

// Body regions (reduced set for posture analysis)
export const POSTURE_BODY_REGIONS = [
  'Cervical', 'Torácica', 'Lombar', 'Sacral',
  'Ombro D', 'Ombro E', 'Quadril D', 'Quadril E',
  'Joelho D', 'Joelho E', 'Tornozelo D', 'Tornozelo E',
] as const

// Commission rates (defaults — actual logic in utils.ts calculateCommission)
// Lead da clínica: 60% clínica, 40% profissional (todos)
// Lead do profissional: 60% profissional, 40% clínica (exceto Janaína: 100%/0%)
export const COMMISSION = {
  CLINICA_PROFESSIONAL_PERCENT: 40,
  CLINICA_CLINIC_PERCENT: 60,
  PROFISSIONAL_PROFESSIONAL_PERCENT: 60,
  PROFISSIONAL_CLINIC_PERCENT: 40,
} as const

// Credit card fee
export const CREDIT_CARD_FEE_PERCENT = 5.99

// Price tables — valores default para seed inicial
// Em produção, usar hook usePriceTables() que busca do banco
export const DEFAULT_PRICE_TABLES = {
  janaina: {
    label: 'Protocolo Janaína',
    evaluation: 400,
    treatment: [
      { name: 'Sessão Avulsa', sessions: 1, price: 350 },
      { name: 'Protocolo Recomendado', sessions: 6, price: 1800, recommended: true },
      { name: 'Protocolo Intensivo', sessions: 8, price: 2240 },
    ],
    maintenance: [
      { name: 'Sessão Avulsa', sessions: 1, price: 350 },
      { name: 'Manutenção Essencial', sessions: 2, price: 610, recommended: true },
      { name: 'Manutenção Intensivo', sessions: 4, price: 1200 },
    ],
  },
  quiropraxistas: {
    label: 'Protocolo Quiropraxistas',
    evaluation: 320,
    treatment: [
      { name: 'Sessão Avulsa', sessions: 1, price: 290 },
      { name: 'Protocolo Recomendado', sessions: 6, price: 1560, recommended: true },
      { name: 'Protocolo Intensivo', sessions: 8, price: 1920 },
    ],
    maintenance: [
      { name: 'Sessão Avulsa', sessions: 1, price: 290 },
      { name: 'Manutenção Essencial', sessions: 2, price: 510, recommended: true },
      { name: 'Manutenção Intensivo', sessions: 4, price: 970 },
    ],
  },
} as const

// Clinic info for PDFs
export const CLINIC_INFO = {
  name: 'Alinhare',
  fullName: 'Clínica Alinhare',
  address: 'Av. das Américas, 500, bl 20, sala 210 - Shopping Downtown',
  phone: '21 99809-0808',
  instagram: '@alinharesaude',
  brandColor: [76, 175, 140] as [number, number, number],
} as const

// Schedule config
export const SCHEDULE = {
  START_HOUR: 7,
  END_HOUR: 20,
  SLOT_COUNT: 14,
  WEEK_DAYS: 7,
} as const

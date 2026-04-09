-- ═══════════════════════════════════════════════════════════════
-- ALINHARE CLÍNICA — SCHEMA COMPLETO (NOVO SISTEMA SEGURO)
-- ═══════════════════════════════════════════════════════════════
-- Diferenças vs sistema Lovable:
--   - Tabela professional_patients (vínculo N:N)
--   - professional_id em treatment_plans e treatment_sessions
--   - Sem coluna patients.age (derivar de birth_date)
--   - birth_date NOT NULL
--   - CHECK constraints em todos os enums
--   - ON DELETE CASCADE onde apropriado
-- ═══════════════════════════════════════════════════════════════

-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'profissional');

-- ═══════════════════════════════════════════════════════════════
-- TABELAS
-- ═══════════════════════════════════════════════════════════════

-- PROFESSIONALS
CREATE TABLE public.professionals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  specialty TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  auth_user_id UUID UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT professionals_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

-- PATIENTS
CREATE TABLE public.patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('masculino', 'feminino', 'outro')),
  height_cm NUMERIC,
  phone TEXT,
  email TEXT,
  cpf TEXT,
  address TEXT,
  sport TEXT,
  surgery_history TEXT,
  medication TEXT,
  health_problems TEXT,
  main_complaint TEXT,
  general_notes TEXT,
  discomfort_regions TEXT[],
  discomfort_intensities JSONB,
  discomfort_frequency TEXT,
  discomfort_duration TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- PROFESSIONAL_PATIENTS (vínculo N:N — NOVO)
CREATE TABLE public.professional_patients (
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (professional_id, patient_id)
);
ALTER TABLE public.professional_patients ENABLE ROW LEVEL SECURITY;

-- TREATMENT_PLANS
CREATE TABLE public.treatment_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.professionals(id),
  plan_name TEXT NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'treatment' CHECK (plan_type IN ('treatment', 'maintenance', 'avaliacao')),
  total_sessions INTEGER NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  price NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'nao_pago' CHECK (payment_status IN ('pago', 'nao_pago', 'pago_pacote')),
  payment_method TEXT NOT NULL DEFAULT 'dinheiro' CHECK (payment_method IN ('dinheiro', 'pix', 'cartao')),
  discount_type TEXT NOT NULL DEFAULT 'value' CHECK (discount_type IN ('value', 'percent')),
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  final_paid_amount NUMERIC NOT NULL DEFAULT 0,
  lead_source TEXT NOT NULL DEFAULT 'clinica' CHECK (lead_source IN ('clinica', 'profissional')),
  lead_professional_id UUID REFERENCES public.professionals(id),
  commission_percentage NUMERIC NOT NULL DEFAULT 40,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  clinic_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;

-- TREATMENT_SESSIONS
CREATE TABLE public.treatment_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.treatment_plans(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.professionals(id),
  session_number INTEGER NOT NULL,
  session_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.treatment_sessions ENABLE ROW LEVEL SECURITY;

-- APPOINTMENTS
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.professionals(id),
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  appointment_type TEXT NOT NULL DEFAULT 'avaliacao' CHECK (appointment_type IN ('avaliacao', 'tratamento', 'manutencao', 'sessao', 'retorno')),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada', 'confirmada', 'cancelada', 'realizada')),
  session_id UUID REFERENCES public.treatment_sessions(id) ON DELETE SET NULL,
  payment_status TEXT NOT NULL DEFAULT 'nao_pago' CHECK (payment_status IN ('pago', 'nao_pago', 'pago_pacote')),
  price_option TEXT,
  custom_price NUMERIC,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  discount_type TEXT NOT NULL DEFAULT 'value' CHECK (discount_type IN ('value', 'percent')),
  final_paid_amount NUMERIC NOT NULL DEFAULT 0,
  lead_source TEXT NOT NULL DEFAULT 'clinica' CHECK (lead_source IN ('clinica', 'profissional')),
  lead_professional_id UUID REFERENCES public.professionals(id),
  payment_method TEXT NOT NULL DEFAULT 'dinheiro' CHECK (payment_method IN ('dinheiro', 'pix', 'cartao')),
  commission_percentage NUMERIC NOT NULL DEFAULT 40,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  clinic_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_appointments_no_conflict
  ON public.appointments (professional_id, appointment_date, appointment_time)
  WHERE status <> 'cancelada';

-- PATIENT_PHOTOS
CREATE TABLE public.patient_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.treatment_sessions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  photo_type TEXT NOT NULL CHECK (photo_type IN ('frente', 'costas', 'lateral_direita', 'lateral_esquerda')),
  photo_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.patient_photos ENABLE ROW LEVEL SECURITY;

-- PATIENT_EXAMS
CREATE TABLE public.patient_exams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  exam_description TEXT,
  ai_analysis TEXT,
  analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.patient_exams ENABLE ROW LEVEL SECURITY;

-- CLINICAL_NOTES
CREATE TABLE public.clinical_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.treatment_sessions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;

-- DISCOMFORT_RECORDS
CREATE TABLE public.discomfort_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.treatment_sessions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  body_region TEXT NOT NULL,
  pain_intensity INTEGER NOT NULL CHECK (pain_intensity BETWEEN 0 AND 10),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.discomfort_records ENABLE ROW LEVEL SECURITY;

-- POSTURE_ANALYSES
CREATE TABLE public.posture_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  session_a_id UUID REFERENCES public.treatment_sessions(id) ON DELETE SET NULL,
  session_b_id UUID REFERENCES public.treatment_sessions(id) ON DELETE SET NULL,
  analysis_text TEXT NOT NULL,
  analysis_type TEXT NOT NULL DEFAULT 'single' CHECK (analysis_type IN ('single', 'compare')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.posture_analyses ENABLE ROW LEVEL SECURITY;

-- PATIENT_EDIT_HISTORY
CREATE TABLE public.patient_edit_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  edit_summary TEXT,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.patient_edit_history ENABLE ROW LEVEL SECURITY;

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE,
  recipient_admin BOOLEAN NOT NULL DEFAULT false,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'appointment' CHECK (type IN ('appointment', 'system')),
  related_appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- MONTHLY_CLOSINGS
CREATE TABLE public.monthly_closings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_month DATE NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado')),
  total_bruto NUMERIC NOT NULL DEFAULT 0,
  total_desconto NUMERIC NOT NULL DEFAULT 0,
  total_liquido NUMERIC NOT NULL DEFAULT 0,
  total_repasse NUMERIC NOT NULL DEFAULT 0,
  total_clinica NUMERIC NOT NULL DEFAULT 0,
  total_appointments INTEGER NOT NULL DEFAULT 0,
  snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  closed_at TIMESTAMPTZ,
  reopened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.monthly_closings ENABLE ROW LEVEL SECURITY;

-- USER_ROLES
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX idx_patients_full_name ON public.patients (full_name);
CREATE INDEX idx_appointments_date ON public.appointments (appointment_date);
CREATE INDEX idx_appointments_professional ON public.appointments (professional_id);
CREATE INDEX idx_appointments_patient ON public.appointments (patient_id);
CREATE INDEX idx_treatment_plans_patient ON public.treatment_plans (patient_id);
CREATE INDEX idx_treatment_plans_professional ON public.treatment_plans (professional_id);
CREATE INDEX idx_treatment_sessions_plan ON public.treatment_sessions (plan_id);
CREATE INDEX idx_treatment_sessions_patient ON public.treatment_sessions (patient_id);
CREATE INDEX idx_professional_patients_patient ON public.professional_patients (patient_id);
CREATE INDEX idx_professional_patients_professional ON public.professional_patients (professional_id);
CREATE INDEX idx_notifications_recipient ON public.notifications (recipient_professional_id);
CREATE INDEX idx_patient_photos_patient ON public.patient_photos (patient_id);
CREATE INDEX idx_patient_photos_session ON public.patient_photos (session_id);
CREATE INDEX idx_monthly_closings_month ON public.monthly_closings (reference_month);

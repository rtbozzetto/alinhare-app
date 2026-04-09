-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  ALINHARE CLÍNICA — SQL COMPLETO PARA NOVO SUPABASE        ║
-- ║  Executar no SQL Editor do Supabase Dashboard               ║
-- ║                                                             ║
-- ║  INSTRUÇÕES:                                                ║
-- ║  1. Abra o SQL Editor no Supabase Dashboard                 ║
-- ║  2. Cole TODO este conteúdo de uma vez                      ║
-- ║  3. Clique "Run" (ou Ctrl+Enter)                            ║
-- ║  4. Verifique se não há erros                               ║
-- ║  5. Depois execute o SQL de VALIDAÇÃO (arquivo separado)    ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════
-- PARTE 1: ENUM
-- ═══════════════════════════════════════════════════════════════

CREATE TYPE public.app_role AS ENUM ('admin', 'profissional');

-- ═══════════════════════════════════════════════════════════════
-- PARTE 2: TABELAS (15) + INDEXES
-- ═══════════════════════════════════════════════════════════════

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

CREATE TABLE public.professional_patients (
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (professional_id, patient_id)
);
ALTER TABLE public.professional_patients ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.treatment_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.professionals(id),
  plan_name TEXT NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'treatment' CHECK (plan_type IN ('treatment', 'maintenance')),
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

CREATE TABLE public.patient_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.treatment_sessions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  photo_type TEXT NOT NULL CHECK (photo_type IN ('frente', 'costas', 'lateral_direita', 'lateral_esquerda')),
  photo_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.patient_photos ENABLE ROW LEVEL SECURITY;

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

CREATE TABLE public.clinical_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.treatment_sessions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;

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

CREATE TABLE public.patient_edit_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  edit_summary TEXT,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.patient_edit_history ENABLE ROW LEVEL SECURITY;

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

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Indexes
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

-- ═══════════════════════════════════════════════════════════════
-- PARTE 3: FUNCTIONS + TRIGGERS
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role::text FROM public.user_roles
  WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_my_professional_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.professionals
  WHERE auth_user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.professional_can_access_patient(_patient_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.professional_patients pp
      JOIN public.professionals p ON p.id = pp.professional_id
      WHERE pp.patient_id = _patient_id
        AND p.auth_user_id = auth.uid()
    )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = 'alinhare.quiro@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_link_professional_patient()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.professional_patients (professional_id, patient_id)
  VALUES (NEW.professional_id, NEW.patient_id)
  ON CONFLICT (professional_id, patient_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Auto-vincular profissional ao paciente quando o profissional cria o paciente
CREATE OR REPLACE FUNCTION public.auto_link_creator_to_patient()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _professional_id UUID;
BEGIN
  SELECT id INTO _professional_id
  FROM public.professionals
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF _professional_id IS NOT NULL THEN
    INSERT INTO public.professional_patients (professional_id, patient_id)
    VALUES (_professional_id, NEW.id)
    ON CONFLICT (professional_id, patient_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Triggers
CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_professionals_updated_at
  BEFORE UPDATE ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_treatment_plans_updated_at
  BEFORE UPDATE ON public.treatment_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_treatment_sessions_updated_at
  BEFORE UPDATE ON public.treatment_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monthly_closings_updated_at
  BEFORE UPDATE ON public.monthly_closings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

CREATE TRIGGER on_patient_created
  AFTER INSERT ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.auto_link_creator_to_patient();

CREATE TRIGGER on_appointment_created
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.auto_link_professional_patient();

-- ═══════════════════════════════════════════════════════════════
-- PARTE 4: RLS POLICIES (43 policies)
-- ═══════════════════════════════════════════════════════════════

-- USER_ROLES
CREATE POLICY "admin_manage_roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "user_read_own_role"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- PROFESSIONALS
CREATE POLICY "admin_full_access_professionals"
  ON public.professionals FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "professional_read_self"
  ON public.professionals FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "professional_read_active"
  ON public.professionals FOR SELECT TO authenticated
  USING (active = true);

-- PATIENTS
CREATE POLICY "admin_full_access_patients"
  ON public.patients FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "professional_read_own_patients"
  ON public.patients FOR SELECT TO authenticated
  USING (professional_can_access_patient(id));

-- Profissional só pode inserir se for profissional ativo ou admin
CREATE POLICY "professional_insert_patients"
  ON public.patients FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.professionals p
      WHERE p.auth_user_id = auth.uid() AND p.active = true
    )
  );

CREATE POLICY "professional_update_own_patients"
  ON public.patients FOR UPDATE TO authenticated
  USING (professional_can_access_patient(id))
  WITH CHECK (professional_can_access_patient(id));

-- PROFESSIONAL_PATIENTS
CREATE POLICY "admin_full_access_professional_patients"
  ON public.professional_patients FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "professional_read_own_links"
  ON public.professional_patients FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.id = professional_id AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "professional_insert_own_links"
  ON public.professional_patients FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.id = professional_id AND p.auth_user_id = auth.uid()
    )
  );

-- APPOINTMENTS
CREATE POLICY "admin_full_access_appointments"
  ON public.appointments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "professional_read_own_appointments"
  ON public.appointments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.id = professional_id AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "professional_insert_own_appointments"
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.id = professional_id AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "professional_update_own_appointments"
  ON public.appointments FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.id = professional_id AND p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.id = professional_id AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "professional_delete_own_appointments"
  ON public.appointments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.id = professional_id AND p.auth_user_id = auth.uid()
    )
  );

-- TREATMENT_PLANS
CREATE POLICY "admin_full_access_treatment_plans"
  ON public.treatment_plans FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "professional_read_own_plans"
  ON public.treatment_plans FOR SELECT TO authenticated
  USING (professional_can_access_patient(patient_id));

CREATE POLICY "professional_insert_own_plans"
  ON public.treatment_plans FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.id = professional_id AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "professional_update_own_plans"
  ON public.treatment_plans FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.id = professional_id AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "professional_delete_own_plans"
  ON public.treatment_plans FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.id = professional_id AND p.auth_user_id = auth.uid()
    )
  );

-- TREATMENT_SESSIONS
CREATE POLICY "admin_full_access_sessions"
  ON public.treatment_sessions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "professional_read_own_sessions"
  ON public.treatment_sessions FOR SELECT TO authenticated
  USING (professional_can_access_patient(patient_id));

CREATE POLICY "professional_insert_own_sessions"
  ON public.treatment_sessions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.id = professional_id AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "professional_update_own_sessions"
  ON public.treatment_sessions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.id = professional_id AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "professional_delete_own_sessions"
  ON public.treatment_sessions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.id = professional_id AND p.auth_user_id = auth.uid()
    )
  );

-- PATIENT_PHOTOS
CREATE POLICY "admin_full_access_photos"
  ON public.patient_photos FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "professional_read_own_photos"
  ON public.patient_photos FOR SELECT TO authenticated
  USING (professional_can_access_patient(patient_id));

CREATE POLICY "professional_insert_own_photos"
  ON public.patient_photos FOR INSERT TO authenticated
  WITH CHECK (professional_can_access_patient(patient_id));

CREATE POLICY "professional_delete_own_photos"
  ON public.patient_photos FOR DELETE TO authenticated
  USING (professional_can_access_patient(patient_id));

-- PATIENT_EXAMS
CREATE POLICY "admin_full_access_exams"
  ON public.patient_exams FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "professional_read_own_exams"
  ON public.patient_exams FOR SELECT TO authenticated
  USING (professional_can_access_patient(patient_id));

CREATE POLICY "professional_insert_own_exams"
  ON public.patient_exams FOR INSERT TO authenticated
  WITH CHECK (professional_can_access_patient(patient_id));

CREATE POLICY "professional_delete_own_exams"
  ON public.patient_exams FOR DELETE TO authenticated
  USING (professional_can_access_patient(patient_id));

-- CLINICAL_NOTES
CREATE POLICY "admin_full_access_notes"
  ON public.clinical_notes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "professional_read_own_notes"
  ON public.clinical_notes FOR SELECT TO authenticated
  USING (professional_can_access_patient(patient_id));

CREATE POLICY "professional_insert_own_notes"
  ON public.clinical_notes FOR INSERT TO authenticated
  WITH CHECK (professional_can_access_patient(patient_id));

CREATE POLICY "professional_update_own_notes"
  ON public.clinical_notes FOR UPDATE TO authenticated
  USING (professional_can_access_patient(patient_id));

CREATE POLICY "professional_delete_own_notes"
  ON public.clinical_notes FOR DELETE TO authenticated
  USING (professional_can_access_patient(patient_id));

-- DISCOMFORT_RECORDS
CREATE POLICY "admin_full_access_discomfort"
  ON public.discomfort_records FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "professional_read_own_discomfort"
  ON public.discomfort_records FOR SELECT TO authenticated
  USING (professional_can_access_patient(patient_id));

CREATE POLICY "professional_insert_own_discomfort"
  ON public.discomfort_records FOR INSERT TO authenticated
  WITH CHECK (professional_can_access_patient(patient_id));

CREATE POLICY "professional_delete_own_discomfort"
  ON public.discomfort_records FOR DELETE TO authenticated
  USING (professional_can_access_patient(patient_id));

-- POSTURE_ANALYSES
CREATE POLICY "admin_full_access_posture"
  ON public.posture_analyses FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "professional_read_own_posture"
  ON public.posture_analyses FOR SELECT TO authenticated
  USING (professional_can_access_patient(patient_id));

CREATE POLICY "professional_insert_own_posture"
  ON public.posture_analyses FOR INSERT TO authenticated
  WITH CHECK (professional_can_access_patient(patient_id));

CREATE POLICY "professional_delete_own_posture"
  ON public.posture_analyses FOR DELETE TO authenticated
  USING (professional_can_access_patient(patient_id));

-- PATIENT_EDIT_HISTORY
CREATE POLICY "admin_full_access_edit_history"
  ON public.patient_edit_history FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "professional_read_own_edit_history"
  ON public.patient_edit_history FOR SELECT TO authenticated
  USING (professional_can_access_patient(patient_id));

CREATE POLICY "professional_insert_edit_history"
  ON public.patient_edit_history FOR INSERT TO authenticated
  WITH CHECK (professional_can_access_patient(patient_id));

-- NOTIFICATIONS
CREATE POLICY "admin_full_access_notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "professional_read_own_notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.id = recipient_professional_id AND p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "professional_update_own_notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.id = recipient_professional_id AND p.auth_user_id = auth.uid()
    )
  );

-- Admin: pode inserir qualquer notificação
CREATE POLICY "admin_insert_notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin')
  );

-- Profissional: só pode inserir notificações vinculadas aos SEUS appointments
CREATE POLICY "professional_insert_own_notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    related_appointment_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.professionals p ON p.id = a.professional_id
      WHERE a.id = related_appointment_id
        AND p.auth_user_id = auth.uid()
    )
  );

-- MONTHLY_CLOSINGS — admin only
CREATE POLICY "admin_only_monthly_closings"
  ON public.monthly_closings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════════════
-- PARTE 5: STORAGE — BUCKETS PRIVADOS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-photos', 'patient-photos', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-files', 'exam-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "authenticated_read_photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'patient-photos');

CREATE POLICY "authenticated_upload_photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'patient-photos');

CREATE POLICY "authenticated_update_photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'patient-photos');

CREATE POLICY "authenticated_delete_photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'patient-photos');

CREATE POLICY "authenticated_read_exams"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'exam-files');

CREATE POLICY "authenticated_upload_exams"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'exam-files');

CREATE POLICY "authenticated_update_exams"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'exam-files');

CREATE POLICY "authenticated_delete_exams"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'exam-files');

-- ═══════════════════════════════════════════════════════════════
-- PARTE 6: PRICE_PROTOCOLS — Tabela de preços editável
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.price_protocols (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_key TEXT NOT NULL CHECK (protocol_key IN ('janaina', 'quiropraxistas')),
  protocol_label TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('treatment', 'maintenance', 'evaluation')),
  plan_name TEXT NOT NULL,
  sessions INTEGER NOT NULL DEFAULT 1,
  price NUMERIC NOT NULL,
  recommended BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (protocol_key, category, plan_name)
);
ALTER TABLE public.price_protocols ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_price_protocols_updated_at
  BEFORE UPDATE ON public.price_protocols
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "authenticated_read_prices"
  ON public.price_protocols FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admin_manage_prices"
  ON public.price_protocols FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE INDEX idx_price_protocols_key_category
  ON public.price_protocols (protocol_key, category, sort_order);

-- Seed: Protocolo Janaína
INSERT INTO public.price_protocols (protocol_key, protocol_label, category, plan_name, sessions, price, recommended, sort_order) VALUES
  ('janaina', 'Protocolo Janaína', 'evaluation', 'Avaliação', 1, 400, false, 0),
  ('janaina', 'Protocolo Janaína', 'treatment', 'Sessão Avulsa', 1, 350, false, 0),
  ('janaina', 'Protocolo Janaína', 'treatment', 'Protocolo Recomendado', 6, 1800, true, 1),
  ('janaina', 'Protocolo Janaína', 'treatment', 'Protocolo Intensivo', 8, 2240, false, 2),
  ('janaina', 'Protocolo Janaína', 'maintenance', 'Sessão Avulsa', 1, 350, false, 0),
  ('janaina', 'Protocolo Janaína', 'maintenance', 'Manutenção Essencial', 2, 610, true, 1),
  ('janaina', 'Protocolo Janaína', 'maintenance', 'Manutenção Intensivo', 4, 1200, false, 2);

-- Seed: Protocolo Quiropraxistas
INSERT INTO public.price_protocols (protocol_key, protocol_label, category, plan_name, sessions, price, recommended, sort_order) VALUES
  ('quiropraxistas', 'Protocolo Quiropraxistas', 'evaluation', 'Avaliação', 1, 320, false, 0),
  ('quiropraxistas', 'Protocolo Quiropraxistas', 'treatment', 'Sessão Avulsa', 1, 290, false, 0),
  ('quiropraxistas', 'Protocolo Quiropraxistas', 'treatment', 'Protocolo Recomendado', 6, 1560, true, 1),
  ('quiropraxistas', 'Protocolo Quiropraxistas', 'treatment', 'Protocolo Intensivo', 8, 1920, false, 2),
  ('quiropraxistas', 'Protocolo Quiropraxistas', 'maintenance', 'Sessão Avulsa', 1, 290, false, 0),
  ('quiropraxistas', 'Protocolo Quiropraxistas', 'maintenance', 'Manutenção Essencial', 2, 510, true, 1),
  ('quiropraxistas', 'Protocolo Quiropraxistas', 'maintenance', 'Manutenção Intensivo', 4, 970, false, 2);

-- ═══════════════════════════════════════════════════════════════
-- FUNCTIONS E TRIGGERS
-- ═══════════════════════════════════════════════════════════════

-- Atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Verifica se usuário tem determinado role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Retorna o role do usuário
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role::text FROM public.user_roles
  WHERE user_id = _user_id LIMIT 1
$$;

-- Retorna o professional_id do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_my_professional_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.professionals
  WHERE auth_user_id = auth.uid() LIMIT 1
$$;

-- Verifica se profissional pode acessar um paciente
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

-- Auto-assign admin role para email específico
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

-- Auto-vincular profissional ao paciente quando criar appointment
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
-- Garante o vínculo no backend (não depende do frontend)
CREATE OR REPLACE FUNCTION public.auto_link_creator_to_patient()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _professional_id UUID;
BEGIN
  -- Busca o professional_id do user que criou o paciente
  SELECT id INTO _professional_id
  FROM public.professionals
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  -- Se o criador é um profissional, vincula automaticamente
  IF _professional_id IS NOT NULL THEN
    INSERT INTO public.professional_patients (professional_id, patient_id)
    VALUES (_professional_id, NEW.id)
    ON CONFLICT (professional_id, patient_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════

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

-- Auto-link profissional ao paciente quando o paciente é criado
CREATE TRIGGER on_patient_created
  AFTER INSERT ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.auto_link_creator_to_patient();

-- Auto-link quando appointment é criado
CREATE TRIGGER on_appointment_created
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.auto_link_professional_patient();

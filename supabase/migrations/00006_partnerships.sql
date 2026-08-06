-- ═══════════════════════════════════════════════════════════════
-- PARTNER_COMPANIES — Empresas parceiras (leads via Clínica > Parceria)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.partner_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_companies ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_partner_companies_updated_at
  BEFORE UPDATE ON public.partner_companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: qualquer autenticado lê, admin gerencia
CREATE POLICY "authenticated_read_partner_companies"
  ON public.partner_companies FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admin_manage_partner_companies"
  ON public.partner_companies FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════════════
-- Adicionar lead_subtype e lead_company_id em treatment_plans e appointments
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.treatment_plans
  ADD COLUMN IF NOT EXISTS lead_subtype TEXT CHECK (lead_subtype IN ('midia_digital', 'parceria')),
  ADD COLUMN IF NOT EXISTS lead_company_id UUID REFERENCES public.partner_companies(id) ON DELETE SET NULL;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS lead_subtype TEXT CHECK (lead_subtype IN ('midia_digital', 'parceria')),
  ADD COLUMN IF NOT EXISTS lead_company_id UUID REFERENCES public.partner_companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_treatment_plans_lead_company ON public.treatment_plans (lead_company_id);
CREATE INDEX IF NOT EXISTS idx_appointments_lead_company ON public.appointments (lead_company_id);

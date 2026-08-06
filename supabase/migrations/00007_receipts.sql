-- ═══════════════════════════════════════════════════════════════
-- CLINIC_SETTINGS — Dados do emissor (nome, CPF/CNPJ, endereço, assinatura)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.clinic_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emitter_name TEXT NOT NULL DEFAULT '',
  emitter_document TEXT NOT NULL DEFAULT '', -- CPF ou CNPJ
  emitter_address TEXT,
  emitter_city TEXT,
  signature_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_clinic_settings_updated_at
  BEFORE UPDATE ON public.clinic_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "authenticated_read_clinic_settings"
  ON public.clinic_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admin_manage_clinic_settings"
  ON public.clinic_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Seed com dados padrão da Janaína/Alinhare (usuário editará depois)
INSERT INTO public.clinic_settings (emitter_name, emitter_document, emitter_city)
VALUES ('Janaína Butafava', '', 'São Paulo');

-- ═══════════════════════════════════════════════════════════════
-- RECEIPTS — Histórico de recibos emitidos
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  payer_name TEXT NOT NULL,
  payer_cpf TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  description TEXT NOT NULL,
  issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
  city TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- RLS: admin gerencia tudo; profissional vê/cria os seus
CREATE POLICY "admin_manage_receipts"
  ON public.receipts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "professional_read_own_receipts"
  ON public.receipts FOR SELECT TO authenticated
  USING (professional_id = get_my_professional_id());

CREATE POLICY "professional_create_own_receipts"
  ON public.receipts FOR INSERT TO authenticated
  WITH CHECK (professional_id = get_my_professional_id());

CREATE INDEX idx_receipts_patient ON public.receipts (patient_id, issued_at DESC);
CREATE INDEX idx_receipts_issued ON public.receipts (issued_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- STORAGE bucket — signatures (PNG da assinatura da Janaína)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "admin_upload_signatures"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signatures' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_update_signatures"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'signatures' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_delete_signatures"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'signatures' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "authenticated_read_signatures"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'signatures');

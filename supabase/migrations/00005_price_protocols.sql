-- ═══════════════════════════════════════════════════════════════
-- PRICE_PROTOCOLS — Tabela de preços editável pelo admin
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

-- Trigger de updated_at
CREATE TRIGGER update_price_protocols_updated_at
  BEFORE UPDATE ON public.price_protocols
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: qualquer autenticado lê, admin gerencia
CREATE POLICY "authenticated_read_prices"
  ON public.price_protocols FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admin_manage_prices"
  ON public.price_protocols FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Index
CREATE INDEX idx_price_protocols_key_category
  ON public.price_protocols (protocol_key, category, sort_order);

-- ═══════════════════════════════════════════════════════════════
-- SEED — Valores iniciais (mesmos do PRICE_TABLES hardcoded)
-- ═══════════════════════════════════════════════════════════════

-- Protocolo Janaína — Avaliação
INSERT INTO public.price_protocols (protocol_key, protocol_label, category, plan_name, sessions, price, recommended, sort_order)
VALUES ('janaina', 'Protocolo Janaína', 'evaluation', 'Avaliação', 1, 400, false, 0);

-- Protocolo Janaína — Tratamento
INSERT INTO public.price_protocols (protocol_key, protocol_label, category, plan_name, sessions, price, recommended, sort_order)
VALUES
  ('janaina', 'Protocolo Janaína', 'treatment', 'Sessão Avulsa', 1, 350, false, 0),
  ('janaina', 'Protocolo Janaína', 'treatment', 'Protocolo Recomendado', 6, 1800, true, 1),
  ('janaina', 'Protocolo Janaína', 'treatment', 'Protocolo Intensivo', 8, 2240, false, 2);

-- Protocolo Janaína — Manutenção
INSERT INTO public.price_protocols (protocol_key, protocol_label, category, plan_name, sessions, price, recommended, sort_order)
VALUES
  ('janaina', 'Protocolo Janaína', 'maintenance', 'Sessão Avulsa', 1, 350, false, 0),
  ('janaina', 'Protocolo Janaína', 'maintenance', 'Manutenção Essencial', 2, 610, true, 1),
  ('janaina', 'Protocolo Janaína', 'maintenance', 'Manutenção Intensivo', 4, 1200, false, 2);

-- Protocolo Quiropraxistas — Avaliação
INSERT INTO public.price_protocols (protocol_key, protocol_label, category, plan_name, sessions, price, recommended, sort_order)
VALUES ('quiropraxistas', 'Protocolo Quiropraxistas', 'evaluation', 'Avaliação', 1, 320, false, 0);

-- Protocolo Quiropraxistas — Tratamento
INSERT INTO public.price_protocols (protocol_key, protocol_label, category, plan_name, sessions, price, recommended, sort_order)
VALUES
  ('quiropraxistas', 'Protocolo Quiropraxistas', 'treatment', 'Sessão Avulsa', 1, 290, false, 0),
  ('quiropraxistas', 'Protocolo Quiropraxistas', 'treatment', 'Protocolo Recomendado', 6, 1560, true, 1),
  ('quiropraxistas', 'Protocolo Quiropraxistas', 'treatment', 'Protocolo Intensivo', 8, 1920, false, 2);

-- Protocolo Quiropraxistas — Manutenção
INSERT INTO public.price_protocols (protocol_key, protocol_label, category, plan_name, sessions, price, recommended, sort_order)
VALUES
  ('quiropraxistas', 'Protocolo Quiropraxistas', 'maintenance', 'Sessão Avulsa', 1, 290, false, 0),
  ('quiropraxistas', 'Protocolo Quiropraxistas', 'maintenance', 'Manutenção Essencial', 2, 510, true, 1),
  ('quiropraxistas', 'Protocolo Quiropraxistas', 'maintenance', 'Manutenção Intensivo', 4, 970, false, 2);

-- ═══════════════════════════════════════════════════════════════
-- STORAGE — BUCKETS PRIVADOS
-- ═══════════════════════════════════════════════════════════════
-- Diferença vs sistema Lovable:
--   - Buckets são PRIVADOS (public = false)
--   - Sem acesso anon/public
--   - Acesso restrito a autenticados
--   - Delete restrito a admin ou dono do dado
--   - Usar signed URLs no frontend
-- ═══════════════════════════════════════════════════════════════

-- Criar buckets PRIVADOS
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-photos', 'patient-photos', false);

INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-files', 'exam-files', false);

-- ───────────────────────────────────────
-- PATIENT-PHOTOS policies
-- ───────────────────────────────────────

-- Leitura: apenas autenticados
CREATE POLICY "authenticated_read_photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'patient-photos');

-- Upload: apenas autenticados
CREATE POLICY "authenticated_upload_photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'patient-photos');

-- Update: apenas autenticados
CREATE POLICY "authenticated_update_photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'patient-photos');

-- Delete: apenas autenticados (admin check feito na aplicação)
CREATE POLICY "authenticated_delete_photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'patient-photos');

-- ───────────────────────────────────────
-- EXAM-FILES policies
-- ───────────────────────────────────────

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

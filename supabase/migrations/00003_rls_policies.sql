-- ═══════════════════════════════════════════════════════════════
-- RLS POLICIES — SEGURANÇA RESTRITIVA
-- ═══════════════════════════════════════════════════════════════
-- Princípios:
--   1. Zero policies USING(true) em tabelas sensíveis
--   2. Admin: acesso total explícito
--   3. Profissional: acesso apenas aos seus pacientes/dados
--   4. Anon: sem acesso a nenhuma tabela
--   5. Menor privilégio em todas as operações
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────
-- USER_ROLES
-- ───────────────────────────────────────
CREATE POLICY "admin_manage_roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "user_read_own_role"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ───────────────────────────────────────
-- PROFESSIONALS
-- ───────────────────────────────────────
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

-- ───────────────────────────────────────
-- PATIENTS
-- ───────────────────────────────────────
CREATE POLICY "admin_full_access_patients"
  ON public.patients FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "professional_read_own_patients"
  ON public.patients FOR SELECT TO authenticated
  USING (professional_can_access_patient(id));

-- Profissional só pode inserir se for profissional ativo ou admin
-- (impede inserts de users sem role ou inativos)
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

-- ───────────────────────────────────────
-- PROFESSIONAL_PATIENTS
-- ───────────────────────────────────────
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

-- ───────────────────────────────────────
-- APPOINTMENTS
-- ───────────────────────────────────────
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

-- ───────────────────────────────────────
-- TREATMENT_PLANS
-- ───────────────────────────────────────
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

-- ───────────────────────────────────────
-- TREATMENT_SESSIONS
-- ───────────────────────────────────────
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

-- ───────────────────────────────────────
-- PATIENT_PHOTOS
-- ───────────────────────────────────────
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

-- ───────────────────────────────────────
-- PATIENT_EXAMS
-- ───────────────────────────────────────
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

-- ───────────────────────────────────────
-- CLINICAL_NOTES
-- ───────────────────────────────────────
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

-- ───────────────────────────────────────
-- DISCOMFORT_RECORDS
-- ───────────────────────────────────────
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

-- ───────────────────────────────────────
-- POSTURE_ANALYSES
-- ───────────────────────────────────────
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

-- ───────────────────────────────────────
-- PATIENT_EDIT_HISTORY
-- ───────────────────────────────────────
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

-- ───────────────────────────────────────
-- NOTIFICATIONS
-- ───────────────────────────────────────
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
-- Profissional: só pode inserir notificações vinculadas aos SEUS appointments
CREATE POLICY "admin_insert_notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin')
  );

CREATE POLICY "professional_insert_own_notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    -- Deve ter um appointment vinculado
    related_appointment_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.professionals p ON p.id = a.professional_id
      WHERE a.id = related_appointment_id
        AND p.auth_user_id = auth.uid()
    )
  );

-- ───────────────────────────────────────
-- MONTHLY_CLOSINGS — admin only
-- ───────────────────────────────────────
CREATE POLICY "admin_only_monthly_closings"
  ON public.monthly_closings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  PASSO 3 — LIMPAR BANCO (dropar tudo para recriar limpo)   ║
-- ║  SÓ EXECUTE SE O PASSO 2 MOSTROU TABELAS EXISTENTES        ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- Dropar triggers primeiro
DROP TRIGGER IF EXISTS on_appointment_created ON public.appointments;
DROP TRIGGER IF EXISTS on_patient_created ON public.patients;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_patients_updated_at ON public.patients;
DROP TRIGGER IF EXISTS update_professionals_updated_at ON public.professionals;
DROP TRIGGER IF EXISTS update_treatment_plans_updated_at ON public.treatment_plans;
DROP TRIGGER IF EXISTS update_treatment_sessions_updated_at ON public.treatment_sessions;
DROP TRIGGER IF EXISTS update_appointments_updated_at ON public.appointments;
DROP TRIGGER IF EXISTS update_monthly_closings_updated_at ON public.monthly_closings;
DROP TRIGGER IF EXISTS update_price_protocols_updated_at ON public.price_protocols;

-- Dropar policies de storage
DROP POLICY IF EXISTS "authenticated_read_photos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_upload_photos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_update_photos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete_photos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_read_exams" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_upload_exams" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_update_exams" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete_exams" ON storage.objects;

-- Dropar buckets de storage
DELETE FROM storage.buckets WHERE id IN ('patient-photos', 'exam-files');

-- Dropar tabelas na ordem correta (respeitando FKs)
DROP TABLE IF EXISTS public.price_protocols CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.monthly_closings CASCADE;
DROP TABLE IF EXISTS public.patient_edit_history CASCADE;
DROP TABLE IF EXISTS public.posture_analyses CASCADE;
DROP TABLE IF EXISTS public.discomfort_records CASCADE;
DROP TABLE IF EXISTS public.clinical_notes CASCADE;
DROP TABLE IF EXISTS public.patient_exams CASCADE;
DROP TABLE IF EXISTS public.patient_photos CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.treatment_sessions CASCADE;
DROP TABLE IF EXISTS public.treatment_plans CASCADE;
DROP TABLE IF EXISTS public.professional_patients CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;
DROP TABLE IF EXISTS public.professionals CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- Dropar functions
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.has_role(UUID, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_my_professional_id() CASCADE;
DROP FUNCTION IF EXISTS public.professional_can_access_patient(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user_role() CASCADE;
DROP FUNCTION IF EXISTS public.auto_link_professional_patient() CASCADE;
DROP FUNCTION IF EXISTS public.auto_link_creator_to_patient() CASCADE;

-- Dropar enum
DROP TYPE IF EXISTS public.app_role CASCADE;

-- Pronto! Agora pode executar o PASSO 4

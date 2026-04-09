-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  VALIDAÇÃO PÓS-EXECUÇÃO                                    ║
-- ║  Execute depois do SQL principal para verificar tudo        ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════
-- 1. VERIFICAR TABELAS CRIADAS (deve retornar 15)
-- ═══════════════════════════════════════════════════════════════
SELECT
  '1. TABELAS' AS verificacao,
  count(*) AS total,
  CASE WHEN count(*) = 15 THEN '✅ OK' ELSE '❌ FALTANDO' END AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'professionals', 'patients', 'professional_patients',
    'treatment_plans', 'treatment_sessions', 'appointments',
    'patient_photos', 'patient_exams', 'clinical_notes',
    'discomfort_records', 'posture_analyses', 'patient_edit_history',
    'notifications', 'monthly_closings', 'user_roles'
  );

-- ═══════════════════════════════════════════════════════════════
-- 2. VERIFICAR RLS ATIVO EM TODAS AS TABELAS (deve retornar 15 com true)
-- ═══════════════════════════════════════════════════════════════
SELECT
  '2. RLS' AS verificacao,
  tablename,
  rowsecurity AS rls_ativo,
  CASE WHEN rowsecurity THEN '✅' ELSE '❌ RLS DESATIVADO' END AS status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'professionals', 'patients', 'professional_patients',
    'treatment_plans', 'treatment_sessions', 'appointments',
    'patient_photos', 'patient_exams', 'clinical_notes',
    'discomfort_records', 'posture_analyses', 'patient_edit_history',
    'notifications', 'monthly_closings', 'user_roles'
  )
ORDER BY tablename;

-- ═══════════════════════════════════════════════════════════════
-- 3. CONTAR POLICIES POR TABELA (nenhuma deve ter "USING (true)" genérica)
-- ═══════════════════════════════════════════════════════════════
SELECT
  '3. POLICIES' AS verificacao,
  schemaname || '.' || tablename AS tabela,
  count(*) AS total_policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- ═══════════════════════════════════════════════════════════════
-- 4. VERIFICAR QUE NÃO EXISTEM POLICIES "USING (true)" GENÉRICAS
-- ═══════════════════════════════════════════════════════════════
SELECT
  '4. POLICIES PERMISSIVAS' AS verificacao,
  tablename,
  policyname,
  qual AS using_clause,
  '❌ POLICY PERMISSIVA DETECTADA' AS status
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = 'true'
  AND policyname NOT LIKE '%insert%';

-- ═══════════════════════════════════════════════════════════════
-- 5. VERIFICAR FUNCTIONS CRIADAS (deve retornar 7)
-- ═══════════════════════════════════════════════════════════════
SELECT
  '5. FUNCTIONS' AS verificacao,
  routine_name,
  '✅' AS status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'update_updated_at_column', 'has_role', 'get_user_role',
    'get_my_professional_id', 'professional_can_access_patient',
    'handle_new_user_role', 'auto_link_professional_patient'
  )
ORDER BY routine_name;

-- ═══════════════════════════════════════════════════════════════
-- 6. VERIFICAR TRIGGERS (deve retornar 8)
-- ═══════════════════════════════════════════════════════════════
SELECT
  '6. TRIGGERS' AS verificacao,
  trigger_name,
  event_object_table AS tabela,
  '✅' AS status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;

-- ═══════════════════════════════════════════════════════════════
-- 7. VERIFICAR STORAGE BUCKETS (devem ser PRIVADOS)
-- ═══════════════════════════════════════════════════════════════
SELECT
  '7. STORAGE' AS verificacao,
  id AS bucket,
  public AS eh_publico,
  CASE WHEN public = false THEN '✅ PRIVADO' ELSE '❌ PÚBLICO - CORRIGIR!' END AS status
FROM storage.buckets
WHERE id IN ('patient-photos', 'exam-files');

-- ═══════════════════════════════════════════════════════════════
-- 8. VERIFICAR CHECK CONSTRAINTS (deve ter vários)
-- ═══════════════════════════════════════════════════════════════
SELECT
  '8. CHECK CONSTRAINTS' AS verificacao,
  table_name,
  constraint_name,
  '✅' AS status
FROM information_schema.table_constraints
WHERE constraint_type = 'CHECK'
  AND table_schema = 'public'
  AND constraint_name NOT LIKE '%not_null%'
ORDER BY table_name;

-- ═══════════════════════════════════════════════════════════════
-- 9. VERIFICAR INDEXES
-- ═══════════════════════════════════════════════════════════════
SELECT
  '9. INDEXES' AS verificacao,
  indexname,
  tablename,
  '✅' AS status
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename;

-- ═══════════════════════════════════════════════════════════════
-- 10. RESUMO FINAL
-- ═══════════════════════════════════════════════════════════════
SELECT '═══ RESUMO FINAL ═══' AS info;

SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tabelas,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') AS policies,
  (SELECT count(*) FROM information_schema.routines WHERE routine_schema = 'public') AS functions,
  (SELECT count(*) FROM information_schema.triggers WHERE trigger_schema = 'public') AS triggers,
  (SELECT count(*) FROM storage.buckets WHERE id IN ('patient-photos', 'exam-files')) AS buckets,
  (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%') AS indexes;

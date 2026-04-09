-- ============================================================
-- Migration 00006: Remove unique constraint on appointments
-- ============================================================
-- O índice único impedia agendamentos no mesmo horário,
-- mesmo quando o profissional deseja manter o conflito.
-- Agora o controle de conflitos é feito na aplicação (alerta).
-- ============================================================

DROP INDEX IF EXISTS public.idx_appointments_no_conflict;

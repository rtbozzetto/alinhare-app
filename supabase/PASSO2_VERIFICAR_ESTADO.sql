-- PASSO 2: Verificar o que já existe no banco
-- Cole este SQL no SQL Editor e clique Run

-- Lista todas as tabelas existentes
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

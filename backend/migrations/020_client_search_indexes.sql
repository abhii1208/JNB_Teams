-- ====================================
-- Migration 020: Client Search Indexes
-- ====================================

DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping pg_trgm extension (insufficient privileges)';
  END;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE INDEX IF NOT EXISTS idx_clients_name_trgm ON clients USING gin (client_name gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_clients_code_trgm ON clients USING gin (client_code gin_trgm_ops);
  END IF;
END$$;

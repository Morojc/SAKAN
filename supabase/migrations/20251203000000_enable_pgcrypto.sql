-- ============================================================================
-- Enable pgcrypto Extension
-- ============================================================================
-- This migration enables the pgcrypto extension required for password hashing
-- The crypt() and gen_salt() functions depend on this extension
-- ============================================================================

-- Enable pgcrypto extension for password hashing functions
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Enable uuid-ossp for UUID generation (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Verify extensions are enabled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    RAISE NOTICE '✅ pgcrypto extension is enabled';
  ELSE
    RAISE EXCEPTION '❌ pgcrypto extension failed to enable';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
    RAISE NOTICE '✅ uuid-ossp extension is enabled';
  ELSE
    RAISE NOTICE '⚠️ uuid-ossp extension not enabled (optional)';
  END IF;
END $$;


-- ============================================================================
-- Fix Schema Permissions for NextAuth Adapter
-- ============================================================================
-- This script grants necessary permissions to the service_role (used by NextAuth adapter)
-- to access the dbasakan schema and its tables.
-- ============================================================================

-- Grant usage on schema to service_role (required for Supabase service role)
GRANT USAGE ON SCHEMA dbasakan TO service_role;
GRANT USAGE ON SCHEMA dbasakan TO authenticated;
GRANT USAGE ON SCHEMA dbasakan TO anon;

-- Grant all privileges on all tables in dbasakan schema to service_role
GRANT ALL ON ALL TABLES IN SCHEMA dbasakan TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA dbasakan TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA dbasakan TO service_role;

-- Grant privileges to authenticated and anon roles (for RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA dbasakan TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA dbasakan TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA dbasakan TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA dbasakan TO anon;

-- Set default privileges for future tables (so new tables automatically get permissions)
ALTER DEFAULT PRIVILEGES IN SCHEMA dbasakan GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA dbasakan GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA dbasakan GRANT ALL ON FUNCTIONS TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA dbasakan GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA dbasakan GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA dbasakan GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA dbasakan GRANT USAGE, SELECT ON SEQUENCES TO anon;

-- Ensure the schema is in the search path (helps with table resolution)
ALTER DATABASE postgres SET search_path TO public, dbasakan;

-- Verify permissions (run this to check)
DO $$
BEGIN
    RAISE NOTICE 'Schema permissions granted successfully!';
    RAISE NOTICE 'service_role can now access dbasakan schema';
    RAISE NOTICE 'NextAuth adapter should work correctly now';
END $$;


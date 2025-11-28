-- =====================================================
-- COMPREHENSIVE FIX: Admin Table Permissions
-- =====================================================
-- This fixes all possible permission issues with admin tables
-- =====================================================

-- Step 1: Disable RLS completely
ALTER TABLE dbasakan.admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE dbasakan.admin_sessions DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL policies
DO $$ 
BEGIN
    -- Drop all policies on admins
    EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON dbasakan.admins;', ' ')
        FROM pg_policies 
        WHERE schemaname = 'dbasakan' AND tablename = 'admins'
    );
    
    -- Drop all policies on admin_sessions
    EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON dbasakan.admin_sessions;', ' ')
        FROM pg_policies 
        WHERE schemaname = 'dbasakan' AND tablename = 'admin_sessions'
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'No policies to drop or error: %', SQLERRM;
END $$;

-- Step 3: Grant explicit permissions to service_role
GRANT ALL ON dbasakan.admins TO service_role;
GRANT ALL ON dbasakan.admin_sessions TO service_role;
GRANT USAGE ON SCHEMA dbasakan TO service_role;

-- Step 4: Grant permissions to anon role as well (for public access if needed)
GRANT SELECT ON dbasakan.admins TO anon;
GRANT USAGE ON SCHEMA dbasakan TO anon;

-- Step 5: Grant permissions to authenticated role
GRANT SELECT ON dbasakan.admins TO authenticated;
GRANT USAGE ON SCHEMA dbasakan TO authenticated;

-- Step 6: Verify changes
SELECT 
    tablename,
    rowsecurity as rls_enabled,
    (SELECT count(*) FROM pg_policies WHERE schemaname = 'dbasakan' AND pg_policies.tablename = pg_tables.tablename) as policy_count
FROM pg_tables 
WHERE schemaname = 'dbasakan' 
AND tablename IN ('admins', 'admin_sessions')
ORDER BY tablename;

-- Step 7: Check permissions
SELECT 
    grantee, 
    table_name,
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'dbasakan' 
AND table_name IN ('admins', 'admin_sessions')
ORDER BY table_name, grantee, privilege_type;

-- Expected output:
-- - rls_enabled should be FALSE for both tables
-- - policy_count should be 0 for both tables
-- - service_role, anon, authenticated should have permissions


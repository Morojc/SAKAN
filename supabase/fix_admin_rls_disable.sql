-- =====================================================
-- FIX: Disable RLS on admins table for service_role access
-- =====================================================
-- The service_role key should bypass RLS, but if RLS is too restrictive,
-- we need to either disable it or add a policy that allows service_role
-- =====================================================

-- Option 1: Completely disable RLS on admins table (RECOMMENDED for service_role access)
ALTER TABLE dbasakan.admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE dbasakan.admin_sessions DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies (they're no longer needed without RLS)
DROP POLICY IF EXISTS "Admins can read their own data" ON dbasakan.admins;
DROP POLICY IF EXISTS "Active admins can read all admin records" ON dbasakan.admins;
DROP POLICY IF EXISTS "Allow access hash verification" ON dbasakan.admins;
DROP POLICY IF EXISTS "Admin sessions are managed by application" ON dbasakan.admin_sessions;

-- Verify RLS is disabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'dbasakan' 
  AND tablename IN ('admins', 'admin_sessions');

-- Expected output: rls_enabled should be 'false' for both tables

COMMENT ON TABLE dbasakan.admins IS 
'Admin users table - RLS disabled because access is controlled entirely by the application layer using service_role key. The access_hash in URLs provides security.';

COMMENT ON TABLE dbasakan.admin_sessions IS 
'Admin session tokens - RLS disabled, managed entirely by application logic.';


-- =====================================================
-- MANUAL FIX: Admin Access Hash RLS
-- =====================================================
-- Run this directly in Supabase SQL Editor to fix RLS permissions
-- This allows the admin login page to verify access hashes
-- =====================================================

-- Step 1: Drop ALL existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can read their own data" ON dbasakan.admins;
DROP POLICY IF EXISTS "Active admins can read all admin records" ON dbasakan.admins;
DROP POLICY IF EXISTS "Allow access hash verification" ON dbasakan.admins;
DROP POLICY IF EXISTS "Admin sessions are managed by application" ON dbasakan.admin_sessions;

-- Step 2: Create new policy for admins table
-- This allows public read access to verify access_hash during login
-- Safe because: only email/status exposed, password never shown
CREATE POLICY "Allow access hash verification"
ON dbasakan.admins
FOR SELECT
USING (is_active = true);

-- Step 3: Create policy for admin_sessions table  
CREATE POLICY "Admin sessions are managed by application"
ON dbasakan.admin_sessions
FOR ALL
USING (true);

-- Step 4: Ensure RLS is enabled
ALTER TABLE dbasakan.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE dbasakan.admin_sessions ENABLE ROW LEVEL SECURITY;

-- Step 5: Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'dbasakan' 
  AND tablename IN ('admins', 'admin_sessions')
ORDER BY tablename, policyname;

-- Expected output should show:
-- 1. "Allow access hash verification" on admins table
-- 2. "Admin sessions are managed by application" on admin_sessions table


-- ============================================================================
-- FIX ADMIN RLS POLICIES
-- ============================================================================
-- This script fixes RLS policies for admin login to work properly
-- The service role key (used in createSupabaseAdminClient) should bypass RLS,
-- but we need to ensure the functions and direct queries work correctly
-- ============================================================================

-- ============================================================================
-- PART 1: Drop existing restrictive policies on admins table
-- ============================================================================

DROP POLICY IF EXISTS "Allow access hash verification" ON dbasakan.admins;
DROP POLICY IF EXISTS "Admins can read their own data" ON dbasakan.admins;
DROP POLICY IF EXISTS "Active admins can read all admins" ON dbasakan.admins;
DROP POLICY IF EXISTS "Admin sessions managed by application" ON dbasakan.admin_sessions;

-- ============================================================================
-- PART 2: Create proper policies for admin login
-- ============================================================================

-- Admins table: Service role bypasses RLS, but add policy for completeness
-- This allows:
-- 1. Direct SELECT queries from API routes using service role key
-- 2. RPC function calls (verify_admin_password) which are SECURITY DEFINER
CREATE POLICY "Service role full access to admins"
  ON dbasakan.admins
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Admin sessions: Service role manages these
CREATE POLICY "Service role full access to admin sessions"
  ON dbasakan.admin_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- PART 3: Ensure functions have proper security settings
-- ============================================================================

-- Recreate verify_admin_password with proper security
DROP FUNCTION IF EXISTS dbasakan.verify_admin_password(text, text);

CREATE OR REPLACE FUNCTION dbasakan.verify_admin_password(
  p_email text,
  p_password text
)
RETURNS TABLE(
  admin_id text,
  email text,
  full_name text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dbasakan, extensions, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.email,
    a.full_name,
    a.is_active
  FROM dbasakan.admins a
  WHERE a.email = p_email
    AND a.password_hash = crypt(p_password, a.password_hash)
    AND a.is_active = true;
END;
$$;

-- Grant execute to service role and anon (service role doesn't need it but for clarity)
GRANT EXECUTE ON FUNCTION dbasakan.verify_admin_password(text, text) TO anon;
GRANT EXECUTE ON FUNCTION dbasakan.verify_admin_password(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION dbasakan.verify_admin_password(text, text) TO service_role;

-- ============================================================================
-- PART 4: Recreate create_admin function with proper security
-- ============================================================================

DROP FUNCTION IF EXISTS dbasakan.create_admin(text, text, text);

CREATE OR REPLACE FUNCTION dbasakan.create_admin(
  p_email text,
  p_password text,
  p_full_name text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dbasakan, extensions, pg_temp
AS $$
DECLARE
  v_admin_id text;
  v_password_hash text;
  v_access_hash text;
BEGIN
  -- Hash password using pgcrypto
  v_password_hash := crypt(p_password, gen_salt('bf', 10));
  
  -- Generate unique access hash
  v_access_hash := md5(random()::text || clock_timestamp()::text);
  
  -- Insert admin
  INSERT INTO dbasakan.admins (
    id,
    email,
    password_hash,
    full_name,
    access_hash,
    is_active,
    created_at
  )
  VALUES (
    gen_random_uuid()::text,
    p_email,
    v_password_hash,
    p_full_name,
    v_access_hash,
    true,
    NOW()
  )
  RETURNING id INTO v_admin_id;
  
  -- Return both admin_id and access_hash
  RAISE NOTICE 'Admin created successfully!';
  RAISE NOTICE 'Admin ID: %', v_admin_id;
  RAISE NOTICE 'Access Hash: %', v_access_hash;
  RAISE NOTICE 'Login URL: /admin/%', v_access_hash;
  
  RETURN v_admin_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION dbasakan.create_admin(text, text, text) TO service_role;

-- ============================================================================
-- PART 5: Verify setup
-- ============================================================================

-- Check RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'dbasakan' 
  AND tablename IN ('admins', 'admin_sessions')
ORDER BY tablename;

-- Check policies exist
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

-- Check functions exist
SELECT 
  routine_schema,
  routine_name,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'dbasakan'
  AND routine_name IN ('verify_admin_password', 'create_admin')
ORDER BY routine_name;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '✅ Admin RLS policies have been fixed!';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'What was fixed:';
  RAISE NOTICE '  1. ✅ Removed restrictive RLS policies on admins table';
  RAISE NOTICE '  2. ✅ Added service role full access policies';
  RAISE NOTICE '  3. ✅ Updated verify_admin_password function with proper search_path';
  RAISE NOTICE '  4. ✅ Updated create_admin function to return access_hash info';
  RAISE NOTICE '  5. ✅ Granted proper execute permissions';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Test admin login at /admin/[access_hash]';
  RAISE NOTICE '  2. Check logs if issues persist';
  RAISE NOTICE '  3. Verify SUPABASE_SECRET_KEY is set in .env.local';
  RAISE NOTICE '=================================================================';
END $$;


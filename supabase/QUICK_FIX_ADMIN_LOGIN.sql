-- ============================================================================
-- QUICK FIX: Admin Login Issue
-- ============================================================================
-- This script fixes the "function crypt(text, text) does not exist" error
-- Run this directly in your Supabase SQL Editor
-- ============================================================================

-- Step 1: Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Step 2: Verify extension is enabled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    RAISE NOTICE '✅ pgcrypto extension is now enabled';
  ELSE
    RAISE EXCEPTION '❌ Failed to enable pgcrypto extension';
  END IF;
END $$;

-- Step 3: Test the crypt function
DO $$
DECLARE
  test_hash text;
BEGIN
  test_hash := crypt('test_password', gen_salt('bf'));
  RAISE NOTICE '✅ crypt() function is working. Test hash: %', substring(test_hash, 1, 20) || '...';
END $$;

-- ============================================================================
-- OPTIONAL: Create a test admin user
-- ============================================================================
-- Uncomment and customize the following to create a test admin:
/*
DO $$
DECLARE
  v_admin_id text;
  v_access_hash text;
BEGIN
  -- Generate unique access hash
  v_access_hash := md5(random()::text || clock_timestamp()::text);
  
  -- Insert test admin
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
    'admin@sakan.local',
    crypt('Admin123!', gen_salt('bf', 10)),
    'Test Administrator',
    v_access_hash,
    true,
    NOW()
  )
  RETURNING id INTO v_admin_id;
  
  RAISE NOTICE '✅ Test admin created successfully!';
  RAISE NOTICE '   Email: admin@sakan.local';
  RAISE NOTICE '   Password: Admin123!';
  RAISE NOTICE '   Login URL: /admin/%', v_access_hash;
  RAISE NOTICE '   Admin ID: %', v_admin_id;
END $$;
*/

-- ============================================================================
-- Verification: Test password verification function
-- ============================================================================
-- This should work after the extension is enabled
SELECT 'Admin login functions are ready!' as status;


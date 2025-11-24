-- ============================================================================
-- CREATE PROFILE TRIGGER
-- Migration: 20241122000000_create_profile_trigger.sql
-- Description: Auto-create profile record when user is inserted into dbasakan.users
-- This is a fallback mechanism in case the NextAuth signIn callback fails
-- Safe to run multiple times (uses CREATE OR REPLACE)
-- ============================================================================

-- ============================================================================
-- FUNCTION: Create profile when user is inserted
-- ============================================================================
CREATE OR REPLACE FUNCTION dbasakan.create_profile_on_user_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile only if it doesn't exist
  INSERT INTO dbasakan.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.name, SPLIT_PART(NEW.email, '@', 1), 'User'),
    'resident'::dbasakan.user_role
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION dbasakan.create_profile_on_user_insert() IS 'Automatically creates a profile record when a new user is inserted into dbasakan.users';

-- ============================================================================
-- TRIGGER: Execute function after user insert
-- ============================================================================
-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_create_profile_after_user_insert ON dbasakan.users;

-- Create trigger
CREATE TRIGGER trigger_create_profile_after_user_insert
AFTER INSERT ON dbasakan.users
FOR EACH ROW
EXECUTE FUNCTION dbasakan.create_profile_on_user_insert();

COMMENT ON TRIGGER trigger_create_profile_after_user_insert ON dbasakan.users IS 'Automatically creates profile when user is inserted via NextAuth';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION dbasakan.create_profile_on_user_insert() TO anon, authenticated, service_role;

-- ============================================================================
-- NOTES
-- ============================================================================
-- This trigger ensures that whenever a user is created in dbasakan.users
-- (by NextAuth), a corresponding profile is automatically created in dbasakan.profiles
-- 
-- The trigger uses ON CONFLICT DO NOTHING to handle cases where:
-- 1. Profile was already created by NextAuth signIn callback
-- 2. Multiple inserts happen simultaneously
-- 
-- The function uses SECURITY DEFINER to run with the privileges of the
-- function owner (typically the database superuser), allowing it to bypass
-- RLS policies when inserting the profile.
-- ============================================================================

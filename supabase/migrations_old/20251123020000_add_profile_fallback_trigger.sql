-- ============================================================================
-- ADD PROFILE FALLBACK TRIGGER
-- Migration: 20251123020000_add_profile_fallback_trigger.sql
-- Description: Add a fallback trigger that creates profiles if they don't exist
--              This is a safety net in case the NextAuth signIn callback fails
--              The trigger uses ON CONFLICT DO NOTHING to avoid conflicts
-- ============================================================================

-- Create function to create profile if it doesn't exist
CREATE OR REPLACE FUNCTION dbasakan.create_profile_if_missing()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile only if it doesn't exist (ON CONFLICT DO NOTHING)
  -- This ensures the trigger doesn't interfere with code-based profile creation
  INSERT INTO dbasakan.profiles (id, full_name, role, onboarding_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.name, SPLIT_PART(NEW.email, '@', 1), 'User'),
    'syndic'::dbasakan.user_role, -- Default to syndic for new signups
    false
  )
  ON CONFLICT (id) DO NOTHING; -- Don't overwrite if profile already exists
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION dbasakan.create_profile_if_missing() IS 'Fallback trigger: Creates profile if it does not exist. Does not overwrite existing profiles. Used as safety net if NextAuth signIn callback fails.';

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_create_profile_fallback ON dbasakan.users;

-- Create trigger
CREATE TRIGGER trigger_create_profile_fallback
AFTER INSERT ON dbasakan.users
FOR EACH ROW
EXECUTE FUNCTION dbasakan.create_profile_if_missing();

COMMENT ON TRIGGER trigger_create_profile_fallback ON dbasakan.users IS 'Fallback trigger: Creates profile if NextAuth callback fails. Uses ON CONFLICT DO NOTHING to avoid conflicts with code-based creation.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION dbasakan.create_profile_if_missing() TO anon, authenticated, service_role;


-- ============================================================================
-- UPDATE PROFILE TRIGGER FOR VERIFICATION
-- Migration: 20250124010000_update_profile_trigger_for_verification.sql
-- Description: Updates the profile fallback trigger to preserve verified status
--              and not interfere with verification flow
-- ============================================================================

-- Update the function to preserve verified status if profile already exists
-- and to not set verified=false when creating new profiles (let code handle it)
CREATE OR REPLACE FUNCTION dbasakan.create_profile_if_missing()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile only if it doesn't exist (ON CONFLICT DO NOTHING)
  -- This ensures the trigger doesn't interfere with code-based profile creation
  -- Don't set verified - let the application code handle verification
  INSERT INTO dbasakan.profiles (id, full_name, role, onboarding_completed, verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.name, SPLIT_PART(NEW.email, '@', 1), 'User'),
    'syndic'::dbasakan.user_role, -- Default to syndic for new signups
    false,
    false -- Default to not verified, but code will update this if verification token exists
  )
  ON CONFLICT (id) DO NOTHING; -- Don't overwrite if profile already exists (preserves verified status)
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION dbasakan.create_profile_if_missing() IS 'Fallback trigger: Creates profile if it does not exist. Does not overwrite existing profiles (preserves verified status). Used as safety net if NextAuth signIn callback fails.';


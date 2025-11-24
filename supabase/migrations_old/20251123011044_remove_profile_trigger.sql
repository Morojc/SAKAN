-- ============================================================================
-- REMOVE PROFILE CREATION TRIGGER - MANAGE FROM CODEBASE
-- Migration: 20251123011044_remove_profile_trigger.sql
-- Description: Remove automatic profile creation trigger - manage entirely from codebase
-- ============================================================================

-- Drop the trigger
DROP TRIGGER IF EXISTS trigger_create_profile_after_user_insert ON dbasakan.users;

-- Drop the function
DROP FUNCTION IF EXISTS dbasakan.create_profile_on_user_insert();

-- Revert table default to 'resident' (code will set role explicitly)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'dbasakan' 
    AND table_name = 'profiles' 
    AND column_name = 'role'
    AND column_default = '''syndic''::dbasakan.user_role'
  ) THEN
    ALTER TABLE dbasakan.profiles 
    ALTER COLUMN role SET DEFAULT 'resident'::dbasakan.user_role;
  END IF;
END $$;

COMMENT ON COLUMN dbasakan.profiles.role IS 'User role: syndic, resident, or guard. Set explicitly by application code, not by database trigger.';


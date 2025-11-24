-- ============================================================================
-- ADD ONBOARDING FIELD AND CHANGE DEFAULT ROLE TO SYNDIC
-- Migration: 20250101000000_add_onboarding_and_syndic_default.sql
-- Description: Add onboarding_completed field and update default role to 'syndic'
-- Safe to run multiple times (uses IF NOT EXISTS and ALTER COLUMN IF EXISTS)
-- ============================================================================

-- Add onboarding_completed field to profiles table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'dbasakan' 
    AND table_name = 'profiles' 
    AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE dbasakan.profiles 
    ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
    
    COMMENT ON COLUMN dbasakan.profiles.onboarding_completed IS 'Indicates if user has completed the initial onboarding flow';
  END IF;
END $$;

-- Update default role to 'syndic' in the table definition
-- Note: This only affects new inserts, existing profiles keep their role
DO $$ 
BEGIN
  -- Check if we need to update the default
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'dbasakan' 
    AND table_name = 'profiles' 
    AND column_name = 'role'
    AND column_default = '''resident''::dbasakan.user_role'
  ) THEN
    ALTER TABLE dbasakan.profiles 
    ALTER COLUMN role SET DEFAULT 'syndic'::dbasakan.user_role;
  END IF;
END $$;

-- Update the profile creation trigger to use 'syndic' as default role
CREATE OR REPLACE FUNCTION dbasakan.create_profile_on_user_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile only if it doesn't exist
  INSERT INTO dbasakan.profiles (id, full_name, role, onboarding_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.name, SPLIT_PART(NEW.email, '@', 1), 'User'),
    'syndic'::dbasakan.user_role,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION dbasakan.create_profile_on_user_insert() IS 'Automatically creates a profile record with syndic role when a new user is inserted into dbasakan.users';


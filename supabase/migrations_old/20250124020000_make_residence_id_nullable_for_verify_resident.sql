-- ============================================================================
-- MAKE RESIDENCE_ID NULLABLE FOR VERIFY_RESIDENT CODES
-- Migration: 20250124020000_make_residence_id_nullable_for_verify_resident.sql
-- Description: Allows residence_id to be NULL for verify_resident access codes
--              This is needed for new signups who don't have a residence yet
-- ============================================================================

-- First, drop the existing foreign key constraint
ALTER TABLE dbasakan.access_codes
  DROP CONSTRAINT IF EXISTS access_codes_residence_id_fkey;

-- Make residence_id nullable
ALTER TABLE dbasakan.access_codes
  ALTER COLUMN residence_id DROP NOT NULL;

-- Re-add the foreign key constraint but allow NULL
ALTER TABLE dbasakan.access_codes
  ADD CONSTRAINT access_codes_residence_id_fkey
  FOREIGN KEY (residence_id)
  REFERENCES dbasakan.residences(id)
  ON DELETE CASCADE;

-- Update the RPC function to accept NULL residence_id
CREATE OR REPLACE FUNCTION dbasakan.create_access_code(
  p_code text,
  p_original_user_id text,
  p_replacement_email text,
  p_residence_id bigint, -- Can be NULL
  p_action_type text,
  p_expires_at timestamp with time zone
)
RETURNS dbasakan.access_codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dbasakan
AS $$
DECLARE
  v_result dbasakan.access_codes;
BEGIN
  INSERT INTO dbasakan.access_codes (
    code,
    original_user_id,
    replacement_email,
    residence_id,
    action_type,
    expires_at
  )
  VALUES (
    p_code,
    p_original_user_id,
    p_replacement_email,
    p_residence_id, -- Can be NULL
    p_action_type,
    p_expires_at
  )
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Add comment
COMMENT ON COLUMN dbasakan.access_codes.residence_id IS 'Residence ID for the access code. Can be NULL for verify_resident codes when user has no residence yet.';


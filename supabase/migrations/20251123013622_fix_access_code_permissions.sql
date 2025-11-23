-- ============================================================================
-- FIX ACCESS CODE CREATION PERMISSIONS
-- Migration: 20251123013622_fix_access_code_permissions.sql
-- Description: Create database function to bypass RLS when creating access codes
-- ============================================================================

-- Create function to insert access codes (bypasses RLS)
CREATE OR REPLACE FUNCTION dbasakan.create_access_code(
  p_code text,
  p_original_user_id text,
  p_replacement_email text,
  p_residence_id bigint,
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
    p_residence_id,
    p_action_type,
    p_expires_at
  )
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION dbasakan.create_access_code IS 'Creates an access code, bypassing RLS policies. Used by service role for syndic replacement flow.';

-- Grant execute permission to service role and authenticated users
GRANT EXECUTE ON FUNCTION dbasakan.create_access_code TO service_role, authenticated;

-- Also update the RLS policy to be more permissive for service role
-- (though the function should handle it, this is a backup)
DROP POLICY IF EXISTS "Syndics can create access codes" ON dbasakan.access_codes;

-- Create a more permissive policy that allows service role
CREATE POLICY "Syndics and service role can create access codes" 
  ON dbasakan.access_codes FOR INSERT 
  WITH CHECK (
    -- Allow if user is a syndic
    EXISTS (
      SELECT 1 FROM dbasakan.profiles
      WHERE id = auth.uid()::text AND role = 'syndic'
    )
    OR
    -- Allow if using service role (no auth.uid() check)
    auth.uid() IS NULL
  );


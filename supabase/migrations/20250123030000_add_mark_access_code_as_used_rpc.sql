-- ============================================================================
-- ADD MARK ACCESS CODE AS USED RPC FUNCTION
-- Migration: 20250123030000_add_mark_access_code_as_used_rpc.sql
-- Description: Creates a database function to securely mark an access code as used
--              bypassing RLS.
-- ============================================================================

CREATE OR REPLACE FUNCTION dbasakan.mark_access_code_as_used(
  p_code text, 
  p_used_by_user_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dbasakan
AS $$
BEGIN
  UPDATE dbasakan.access_codes
  SET 
    code_used = true,
    used_by_user_id = p_used_by_user_id,
    used_at = now()
  WHERE code = p_code;
  
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION dbasakan.mark_access_code_as_used(text, text) IS 'Marks an access code as used, bypassing RLS.';

-- Grant execute permission to service role and authenticated users
GRANT EXECUTE ON FUNCTION dbasakan.mark_access_code_as_used TO service_role, authenticated;


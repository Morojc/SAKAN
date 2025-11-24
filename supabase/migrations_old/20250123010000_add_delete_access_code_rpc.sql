-- ============================================================================
-- ADD DELETE ACCESS CODE RPC FUNCTION
-- Migration: 20250123010000_add_delete_access_code_rpc.sql
-- Description: Create database function to bypass RLS when deleting access codes
-- ============================================================================

-- Create function to delete access codes (bypasses RLS)
CREATE OR REPLACE FUNCTION dbasakan.delete_access_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dbasakan
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM dbasakan.access_codes
  WHERE code = p_code;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count > 0;
END;
$$;

COMMENT ON FUNCTION dbasakan.delete_access_code(text) IS 'Deletes an access code by code string, bypassing RLS policies. Used by service role for cancelling access codes.';

-- Grant execute permission to service role and authenticated users
GRANT EXECUTE ON FUNCTION dbasakan.delete_access_code(text) TO service_role, authenticated;


-- ============================================================================
-- ADD VALIDATE ACCESS CODE RPC
-- Migration: 20251123023000_add_validate_code_rpc.sql
-- Description: Create a secure RPC function to fetch access code details
--              bypassing RLS for validation purposes.
-- ============================================================================

-- Create function to get access code by code string
CREATE OR REPLACE FUNCTION dbasakan.get_access_code_by_code(p_code text)
RETURNS SETOF dbasakan.access_codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dbasakan
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM dbasakan.access_codes
  WHERE code = p_code;
END;
$$;

COMMENT ON FUNCTION dbasakan.get_access_code_by_code(text) IS 'Fetches access code details by code string, bypassing RLS. Used for code validation.';

-- Grant execute permission to service role and authenticated users (and anon for sign-in page validation)
GRANT EXECUTE ON FUNCTION dbasakan.get_access_code_by_code(text) TO anon, authenticated, service_role;


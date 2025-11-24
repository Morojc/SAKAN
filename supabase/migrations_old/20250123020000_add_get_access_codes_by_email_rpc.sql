-- ============================================================================
-- ADD GET ACCESS CODES BY EMAIL RPC FUNCTION
-- Migration: 20250123020000_add_get_access_codes_by_email_rpc.sql
-- Description: Creates a database function to securely retrieve access codes by email
--              bypassing RLS.
-- ============================================================================

CREATE OR REPLACE FUNCTION dbasakan.get_access_codes_by_email(p_email text)
RETURNS SETOF dbasakan.access_codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dbasakan
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM dbasakan.access_codes
  WHERE replacement_email = p_email;
END;
$$;

COMMENT ON FUNCTION dbasakan.get_access_codes_by_email(text) IS 'Retrieves access codes by replacement email, bypassing RLS. Used for checking if user is a replacement email.';

-- Grant execute permission to service role and authenticated users
GRANT EXECUTE ON FUNCTION dbasakan.get_access_codes_by_email TO service_role, authenticated;


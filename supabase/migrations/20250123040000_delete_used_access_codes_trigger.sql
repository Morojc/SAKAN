-- ============================================================================
-- ADD TRIGGER TO DELETE USED ACCESS CODES
-- Migration: 20250123040000_delete_used_access_codes_trigger.sql
-- Description: Creates a trigger to automatically delete access codes when
--              code_used becomes true.
-- ============================================================================

-- Create the trigger function
CREATE OR REPLACE FUNCTION dbasakan.delete_used_access_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dbasakan
AS $$
BEGIN
  -- Check if code_used changed to true
  IF NEW.code_used = true AND (OLD.code_used = false OR OLD.code_used IS NULL) THEN
    -- Delete the row
    DELETE FROM dbasakan.access_codes WHERE id = NEW.id;
    -- Return null because the row is deleted, so we can't return NEW
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_delete_used_access_code ON dbasakan.access_codes;

CREATE TRIGGER trigger_delete_used_access_code
  AFTER UPDATE OF code_used ON dbasakan.access_codes
  FOR EACH ROW
  WHEN (NEW.code_used = true)
  EXECUTE FUNCTION dbasakan.delete_used_access_code();

COMMENT ON TRIGGER trigger_delete_used_access_code ON dbasakan.access_codes IS 'Automatically deletes the access code record when code_used is set to true.';


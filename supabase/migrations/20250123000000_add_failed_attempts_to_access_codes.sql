-- ============================================================================
-- ADD FAILED ATTEMPTS TO ACCESS CODES
-- Migration: 20250123000000_add_failed_attempts_to_access_codes.sql
-- Description: Add failed_attempts field to track incorrect code entry attempts
--              and enable automatic code deletion after 3 failed attempts
-- ============================================================================

-- Add failed_attempts column to access_codes table
ALTER TABLE dbasakan.access_codes
ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0;

-- Add index for performance when querying by failed attempts
CREATE INDEX IF NOT EXISTS idx_access_codes_failed_attempts 
ON dbasakan.access_codes(failed_attempts) 
WHERE failed_attempts < 3;

-- Add comment
COMMENT ON COLUMN dbasakan.access_codes.failed_attempts IS 'Number of failed validation attempts. Code is invalidated after 3 failed attempts.';


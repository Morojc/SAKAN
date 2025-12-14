-- ============================================================================
-- Migration: Allow Multiple Apartments Per Residence
-- Description: Updates profile_residences to allow same user in same residence
--              multiple times, but only once per apartment number
-- ============================================================================

-- Drop the old unique constraint
ALTER TABLE dbasakan.profile_residences 
DROP CONSTRAINT IF EXISTS profile_residences_unique;

-- Add new unique constraint that includes apartment_number
-- This allows same user in same residence multiple times, but unique per apartment
ALTER TABLE dbasakan.profile_residences 
ADD CONSTRAINT profile_residences_unique 
UNIQUE (profile_id, residence_id, apartment_number);

-- Add a partial unique index to handle NULL apartment_number
-- Only one entry with NULL apartment_number per (profile_id, residence_id)
-- This ensures guards or users without apartment numbers can only be added once per residence
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_residences_null_apartment 
ON dbasakan.profile_residences(profile_id, residence_id) 
WHERE apartment_number IS NULL;

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT profile_residences_unique ON dbasakan.profile_residences IS 
  'Allows same user to be in same residence multiple times, but only once per apartment number. Multiple entries with NULL apartment_number are prevented by idx_profile_residences_null_apartment.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================


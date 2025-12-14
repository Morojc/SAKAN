-- ============================================================================
-- Migration: Add Apartment Number to Payments
-- Description: Adds apartment_number and profile_residence_id to payments table
--              to properly link payments to specific resident-apartment combinations
-- ============================================================================

-- Add apartment_number column to payments table
ALTER TABLE dbasakan.payments
  ADD COLUMN IF NOT EXISTS apartment_number text;

-- Add profile_residence_id column to link payments to specific profile_residences entry
-- This ensures payments are linked to the specific apartment the resident occupies
ALTER TABLE dbasakan.payments
  ADD COLUMN IF NOT EXISTS profile_residence_id bigint;

-- Add foreign key constraint for profile_residence_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payments_profile_residence_id_fkey'
  ) THEN
    ALTER TABLE dbasakan.payments
      ADD CONSTRAINT payments_profile_residence_id_fkey 
      FOREIGN KEY (profile_residence_id) 
      REFERENCES dbasakan.profile_residences(id) 
      ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for apartment_number lookups
CREATE INDEX IF NOT EXISTS idx_payments_apartment_number 
  ON dbasakan.payments(apartment_number) 
  WHERE apartment_number IS NOT NULL;

-- Add index for profile_residence_id lookups
CREATE INDEX IF NOT EXISTS idx_payments_profile_residence_id 
  ON dbasakan.payments(profile_residence_id) 
  WHERE profile_residence_id IS NOT NULL;

-- Composite index for efficient queries filtering payments by residence and apartment
CREATE INDEX IF NOT EXISTS idx_payments_residence_apartment 
  ON dbasakan.payments(residence_id, apartment_number) 
  WHERE apartment_number IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN dbasakan.payments.apartment_number IS 
  'Apartment number for the payment. Links payment to specific apartment in the residence.';

COMMENT ON COLUMN dbasakan.payments.profile_residence_id IS 
  'Foreign key to profile_residences table. Links payment to specific resident-apartment combination.';

COMMENT ON INDEX dbasakan.idx_payments_apartment_number IS 
  'Index for filtering payments by apartment number';

COMMENT ON INDEX dbasakan.idx_payments_profile_residence_id IS 
  'Index for filtering payments by profile_residence_id (resident-apartment combination)';

COMMENT ON INDEX dbasakan.idx_payments_residence_apartment IS 
  'Composite index for efficient queries filtering payments by residence and apartment number';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================


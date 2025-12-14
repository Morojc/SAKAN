-- ============================================================================
-- Migration: Prevent Duplicate Apartment Assignments
-- Description: Ensures each apartment number can only be assigned to one user
--              per residence. Multiple users cannot share the same apartment.
-- ============================================================================

-- Add a unique constraint on (residence_id, apartment_number) for non-NULL apartments
-- This ensures each apartment can only be assigned to one user
-- Note: This will fail if there are existing duplicate apartment assignments
-- If it fails, you'll need to resolve duplicate apartment assignments first
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_residences_residence_apartment_unique 
ON dbasakan.profile_residences(residence_id, apartment_number) 
WHERE apartment_number IS NOT NULL;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

a
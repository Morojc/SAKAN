-- ============================================================================
-- ADD OTP VERIFICATION INDEXES
-- Migration: 20251204000000_add_otp_verification_indexes.sql
-- Description: Adds indexes for OTP verification system to improve query performance
-- ============================================================================

-- ============================================================================
-- PART 1: ADD INDEXES FOR EMAIL VERIFICATION
-- ============================================================================

-- Note: idx_profiles_email_verification_code already exists from migration 20251124194832
-- This migration adds additional indexes for OTP verification performance

-- Index for email_verified status filtering (used to filter verified/unverified residents)
CREATE INDEX IF NOT EXISTS idx_profiles_email_verified 
  ON dbasakan.profiles(email_verified) 
  WHERE email_verified = false;

-- Index for email_verification_code_expires_at (used to check expiration)
CREATE INDEX IF NOT EXISTS idx_profiles_email_verification_code_expires_at 
  ON dbasakan.profiles(email_verification_code_expires_at) 
  WHERE email_verification_code_expires_at IS NOT NULL;

-- ============================================================================
-- PART 2: ADD INDEXES FOR PROFILE_RESIDENCES VERIFICATION
-- ============================================================================

-- Index for profile_residences.verified status filtering
-- This is used to filter verified/unverified residents in the residents list
CREATE INDEX IF NOT EXISTS idx_profile_residences_verified 
  ON dbasakan.profile_residences(verified) 
  WHERE verified = false;

-- Composite index for residence_id and verified (common query pattern)
-- Used when fetching residents for a specific residence filtered by verification status
CREATE INDEX IF NOT EXISTS idx_profile_residences_residence_id_verified 
  ON dbasakan.profile_residences(residence_id, verified);

-- ============================================================================
-- PART 3: ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON INDEX dbasakan.idx_profiles_email_verified IS 
  'Index for filtering verified/unverified users by email verification status';

COMMENT ON INDEX dbasakan.idx_profiles_email_verification_code_expires_at IS 
  'Index for checking OTP code expiration timestamps';

COMMENT ON INDEX dbasakan.idx_profile_residences_verified IS 
  'Index for filtering verified/unverified residents in residence listings';

COMMENT ON INDEX dbasakan.idx_profile_residences_residence_id_verified IS 
  'Composite index for efficient queries filtering residents by residence and verification status';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================


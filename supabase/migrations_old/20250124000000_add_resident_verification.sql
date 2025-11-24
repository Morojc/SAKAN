-- ============================================================================
-- ADD RESIDENT VERIFICATION
-- Migration: 20250124000000_add_resident_verification.sql
-- Description: Adds verification fields to profiles table for resident verification flow
-- ============================================================================

-- Add verification columns to profiles table
ALTER TABLE dbasakan.profiles
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS verification_token_expires_at timestamp with time zone;

-- Create index for verification token lookups
CREATE INDEX IF NOT EXISTS idx_profiles_verification_token ON dbasakan.profiles(verification_token) WHERE verification_token IS NOT NULL;

-- Create index for verified status filtering
CREATE INDEX IF NOT EXISTS idx_profiles_verified ON dbasakan.profiles(verified, residence_id) WHERE verified = true;

-- Add comment
COMMENT ON COLUMN dbasakan.profiles.verified IS 'Whether the resident has verified their account via email link';
COMMENT ON COLUMN dbasakan.profiles.verification_token IS 'Unique token for email verification, expires after 7 days';
COMMENT ON COLUMN dbasakan.profiles.verification_token_expires_at IS 'Expiration timestamp for the verification token';


-- Migration: Separate Resident Onboarding OTP from Email Verification Code
-- Description: Adds separate fields for resident onboarding OTP to avoid conflicts
-- with email verification code used for authentication

-- Add new columns for resident onboarding OTP
ALTER TABLE dbasakan.profiles
  ADD COLUMN IF NOT EXISTS resident_onboarding_code text,
  ADD COLUMN IF NOT EXISTS resident_onboarding_code_expires_at timestamp with time zone;

-- Add index for resident onboarding code lookup
CREATE INDEX IF NOT EXISTS idx_profiles_resident_onboarding_code 
  ON dbasakan.profiles(resident_onboarding_code) 
  WHERE resident_onboarding_code IS NOT NULL;

-- Add index for resident onboarding code expiration
CREATE INDEX IF NOT EXISTS idx_profiles_resident_onboarding_code_expires_at 
  ON dbasakan.profiles(resident_onboarding_code_expires_at) 
  WHERE resident_onboarding_code_expires_at IS NOT NULL;

-- Add comments explaining the separation
COMMENT ON COLUMN dbasakan.profiles.email_verification_code IS 
  'OTP code for email verification during initial authentication/signup. Used by /api/verify-email-code endpoint.';

COMMENT ON COLUMN dbasakan.profiles.email_verification_code_expires_at IS 
  'Expiration timestamp for email verification OTP code. Used for authentication.';

COMMENT ON COLUMN dbasakan.profiles.resident_onboarding_code IS 
  'OTP code for resident onboarding when added by syndic. Used by /api/mobile/auth/verify-otp endpoint. Separate from email verification.';

COMMENT ON COLUMN dbasakan.profiles.resident_onboarding_code_expires_at IS 
  'Expiration timestamp for resident onboarding OTP code. Used when syndic adds a resident.';

COMMENT ON INDEX dbasakan.idx_profiles_resident_onboarding_code IS 
  'Index for quick lookup of resident onboarding OTP codes';

COMMENT ON INDEX dbasakan.idx_profiles_resident_onboarding_code_expires_at IS 
  'Index for checking resident onboarding OTP code expiration timestamps';


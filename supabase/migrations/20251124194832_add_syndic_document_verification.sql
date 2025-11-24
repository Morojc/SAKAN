-- ============================================================================
-- ADD SYNDIC DOCUMENT VERIFICATION SYSTEM
-- Migration: 20251124194832_add_syndic_document_verification.sql
-- Description: Adds document verification workflow for syndic signups
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE ENUMS
-- ============================================================================

DO $$ 
BEGIN
  -- Document Submission Status Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_submission_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbasakan')) THEN
    CREATE TYPE dbasakan.document_submission_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

-- ============================================================================
-- PART 2: ADD EMAIL VERIFICATION FIELDS TO PROFILES TABLE
-- ============================================================================

ALTER TABLE dbasakan.profiles
  ADD COLUMN IF NOT EXISTS email_verification_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS email_verification_code_expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

-- Create index for email verification code lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email_verification_code 
  ON dbasakan.profiles(email_verification_code) 
  WHERE email_verification_code IS NOT NULL;

-- Add comments
COMMENT ON COLUMN dbasakan.profiles.email_verification_code IS '6-character alphanumeric verification code sent after Gmail authentication';
COMMENT ON COLUMN dbasakan.profiles.email_verification_code_expires_at IS 'Expiration timestamp for email verification code (15 minutes)';
COMMENT ON COLUMN dbasakan.profiles.email_verified IS 'Whether the user has verified their email with the verification code';

-- ============================================================================
-- PART 3: CREATE SYNDIC DOCUMENT SUBMISSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS dbasakan.syndic_document_submissions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id text NOT NULL,
  document_url text NOT NULL,
  status dbasakan.document_submission_status NOT NULL DEFAULT 'pending'::dbasakan.document_submission_status,
  submitted_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by text,
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT syndic_document_submissions_pkey PRIMARY KEY (id),
  CONSTRAINT syndic_document_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES dbasakan.profiles(id),
  CONSTRAINT syndic_document_submissions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES dbasakan.profiles(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_syndic_document_submissions_user_id 
  ON dbasakan.syndic_document_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_syndic_document_submissions_status 
  ON dbasakan.syndic_document_submissions(status);
CREATE INDEX IF NOT EXISTS idx_syndic_document_submissions_submitted_at 
  ON dbasakan.syndic_document_submissions(submitted_at);

-- Add comments
COMMENT ON TABLE dbasakan.syndic_document_submissions IS 'Tracks procès verbal document submissions for syndic verification';
COMMENT ON COLUMN dbasakan.syndic_document_submissions.document_url IS 'Supabase Storage path to the uploaded document';
COMMENT ON COLUMN dbasakan.syndic_document_submissions.status IS 'Current status of the document submission';
COMMENT ON COLUMN dbasakan.syndic_document_submissions.reviewed_by IS 'Admin profile ID who reviewed the document';

-- ============================================================================
-- PART 4: GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA dbasakan TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON dbasakan.syndic_document_submissions TO authenticated;
GRANT ALL ON dbasakan.syndic_document_submissions TO service_role;

-- ============================================================================
-- PART 5: CREATE STORAGE BUCKET (if not exists)
-- Note: This requires Supabase Storage API. If bucket creation fails,
-- create it manually via Supabase Dashboard or CLI
-- ============================================================================

-- Storage bucket creation is typically done via Supabase Dashboard or CLI
-- Bucket name: SAKAN
-- Public: false (private bucket)
-- File size limit: 50MB (or as configured)
-- Allowed MIME types: application/pdf, image/* (or as needed)

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================


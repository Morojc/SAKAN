-- ============================================================================
-- ADD SYNDIC DELETION REQUESTS SYSTEM
-- Migration: 20250101000000_add_syndic_deletion_requests.sql
-- Description: Adds deletion request workflow for syndic account deletion
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE ENUMS
-- ============================================================================

DO $$ 
BEGIN
  -- Deletion Request Status Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deletion_request_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbasakan')) THEN
    CREATE TYPE dbasakan.deletion_request_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
  END IF;
END $$;

-- ============================================================================
-- PART 2: CREATE SYNDIC DELETION REQUESTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS dbasakan.syndic_deletion_requests (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  syndic_user_id text NOT NULL,
  residence_id bigint NOT NULL,
  status dbasakan.deletion_request_status NOT NULL DEFAULT 'pending'::dbasakan.deletion_request_status,
  requested_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by text, -- Admin ID who reviewed the request
  successor_user_id text, -- The resident selected by admin to become the new syndic
  rejection_reason text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT syndic_deletion_requests_pkey PRIMARY KEY (id),
  CONSTRAINT syndic_deletion_requests_syndic_user_id_fkey FOREIGN KEY (syndic_user_id) REFERENCES dbasakan.profiles(id) ON DELETE CASCADE,
  CONSTRAINT syndic_deletion_requests_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id) ON DELETE CASCADE,
  CONSTRAINT syndic_deletion_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES dbasakan.admins(id),
  CONSTRAINT syndic_deletion_requests_successor_user_id_fkey FOREIGN KEY (successor_user_id) REFERENCES dbasakan.profiles(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_syndic_deletion_requests_syndic_user_id 
  ON dbasakan.syndic_deletion_requests(syndic_user_id);
CREATE INDEX IF NOT EXISTS idx_syndic_deletion_requests_residence_id 
  ON dbasakan.syndic_deletion_requests(residence_id);
CREATE INDEX IF NOT EXISTS idx_syndic_deletion_requests_status 
  ON dbasakan.syndic_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_syndic_deletion_requests_requested_at 
  ON dbasakan.syndic_deletion_requests(requested_at);

-- Add comments
COMMENT ON TABLE dbasakan.syndic_deletion_requests IS 'Tracks syndic account deletion requests that require admin approval and successor selection';
COMMENT ON COLUMN dbasakan.syndic_deletion_requests.status IS 'Current status of the deletion request';
COMMENT ON COLUMN dbasakan.syndic_deletion_requests.reviewed_by IS 'Admin ID who reviewed and approved/rejected the request';
COMMENT ON COLUMN dbasakan.syndic_deletion_requests.successor_user_id IS 'The resident selected by admin to become the new syndic';

-- ============================================================================
-- PART 3: GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA dbasakan TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON dbasakan.syndic_deletion_requests TO authenticated;
GRANT ALL ON dbasakan.syndic_deletion_requests TO service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================


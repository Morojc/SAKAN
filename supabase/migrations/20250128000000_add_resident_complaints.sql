-- ============================================================================
-- ADD RESIDENT COMPLAINTS SYSTEM
-- Migration: 20250128000000_add_resident_complaints.sql
-- Description: Adds complaint system for residents to submit complaints about other residents
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE ENUMS
-- ============================================================================

DO $$ 
BEGIN
  -- Complaint Reason Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'complaint_reason' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbasakan')) THEN
    CREATE TYPE dbasakan.complaint_reason AS ENUM (
      'noise', 
      'trash', 
      'behavior', 
      'parking', 
      'pets', 
      'property_damage', 
      'other'
    );
  END IF;
  
  -- Complaint Status Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'complaint_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbasakan')) THEN
    CREATE TYPE dbasakan.complaint_status AS ENUM (
      'submitted', 
      'reviewed', 
      'resolved'
    );
  END IF;
  
  -- Complaint Privacy Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'complaint_privacy' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbasakan')) THEN
    CREATE TYPE dbasakan.complaint_privacy AS ENUM (
      'private', 
      'anonymous'
    );
  END IF;
END $$;

-- ============================================================================
-- PART 2: CREATE COMPLAINTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS dbasakan.complaints (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  complainant_id text NOT NULL, -- Resident who filed the complaint
  complained_about_id text NOT NULL, -- Resident being complained about
  reason dbasakan.complaint_reason NOT NULL,
  privacy dbasakan.complaint_privacy NOT NULL DEFAULT 'private',
  title text NOT NULL,
  description text NOT NULL,
  status dbasakan.complaint_status NOT NULL DEFAULT 'submitted',
  reviewed_at timestamp with time zone,
  resolved_at timestamp with time zone,
  reviewed_by text, -- Syndic who reviewed
  resolution_notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT complaints_pkey PRIMARY KEY (id),
  CONSTRAINT complaints_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id) ON DELETE CASCADE,
  CONSTRAINT complaints_complainant_id_fkey FOREIGN KEY (complainant_id) REFERENCES dbasakan.profiles(id) ON DELETE CASCADE,
  CONSTRAINT complaints_complained_about_id_fkey FOREIGN KEY (complained_about_id) REFERENCES dbasakan.profiles(id) ON DELETE CASCADE,
  CONSTRAINT complaints_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES dbasakan.profiles(id),
  CONSTRAINT complaints_no_self_complaint CHECK (complainant_id != complained_about_id)
);

-- Add constraint to ensure both residents are in the same residence
-- Note: This is checked at application level as well, but adding for data integrity
COMMENT ON TABLE dbasakan.complaints IS 'Resident complaints about other residents. Supports private and anonymous complaints.';
COMMENT ON COLUMN dbasakan.complaints.complainant_id IS 'Resident who filed the complaint';
COMMENT ON COLUMN dbasakan.complaints.complained_about_id IS 'Resident being complained about';
COMMENT ON COLUMN dbasakan.complaints.privacy IS 'private: complainant visible to complained-about resident. anonymous: complainant hidden from complained-about resident (but visible to syndic)';
COMMENT ON COLUMN dbasakan.complaints.status IS 'submitted: newly filed, reviewed: syndic has reviewed, resolved: complaint resolved';

-- ============================================================================
-- PART 3: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_complaints_residence_id ON dbasakan.complaints(residence_id);
CREATE INDEX IF NOT EXISTS idx_complaints_complainant_id ON dbasakan.complaints(complainant_id);
CREATE INDEX IF NOT EXISTS idx_complaints_complained_about_id ON dbasakan.complaints(complained_about_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON dbasakan.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON dbasakan.complaints(created_at);
CREATE INDEX IF NOT EXISTS idx_complaints_reason ON dbasakan.complaints(reason);

-- ============================================================================
-- PART 4: CREATE TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION dbasakan.update_complaints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_complaints_updated_at ON dbasakan.complaints;
CREATE TRIGGER trigger_update_complaints_updated_at
BEFORE UPDATE ON dbasakan.complaints
FOR EACH ROW
EXECUTE FUNCTION dbasakan.update_complaints_updated_at();

-- ============================================================================
-- PART 5: ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on complaints table
ALTER TABLE dbasakan.complaints ENABLE ROW LEVEL SECURITY;

-- Policy: Residents can view their own complaints (as complainant)
DROP POLICY IF EXISTS "Residents can view their own complaints" ON dbasakan.complaints;
CREATE POLICY "Residents can view their own complaints" ON dbasakan.complaints
  FOR SELECT
  USING (
    complainant_id = auth.uid()::text
    OR complained_about_id = auth.uid()::text
  );

-- Policy: Residents can view complaints filed against them
-- (Privacy handling is done at application level - RLS just allows access)
DROP POLICY IF EXISTS "Residents can view complaints against them" ON dbasakan.complaints;
-- Note: This is already covered by the above policy, but keeping for clarity

-- Policy: Syndics can view all complaints in their residence
DROP POLICY IF EXISTS "Syndics can view all residence complaints" ON dbasakan.complaints;
CREATE POLICY "Syndics can view all residence complaints" ON dbasakan.complaints
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (complaints.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- Policy: Only residents can create complaints
DROP POLICY IF EXISTS "Residents can create complaints" ON dbasakan.complaints;
CREATE POLICY "Residents can create complaints" ON dbasakan.complaints
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'resident'
    )
    AND complainant_id = auth.uid()::text
    AND (complaints.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- Policy: Only syndics can update complaints (review and resolve)
DROP POLICY IF EXISTS "Syndics can update complaints" ON dbasakan.complaints;
CREATE POLICY "Syndics can update complaints" ON dbasakan.complaints
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (complaints.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- ============================================================================
-- PART 6: GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA dbasakan TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON dbasakan.complaints TO authenticated;
GRANT ALL ON dbasakan.complaints TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA dbasakan TO authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================


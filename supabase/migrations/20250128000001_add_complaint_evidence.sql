-- ============================================================================
-- ADD COMPLAINT EVIDENCE SUPPORT
-- Migration: 20250128000001_add_complaint_evidence.sql
-- Description: Adds evidence table for storing complaint attachments (photos, audio, video)
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE COMPLAINT EVIDENCE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS dbasakan.complaint_evidence (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  complaint_id bigint NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL, -- 'image', 'audio', 'video'
  file_size bigint NOT NULL, -- Size in bytes
  mime_type text NOT NULL, -- e.g., 'image/jpeg', 'audio/mpeg', 'video/mp4'
  uploaded_by text NOT NULL, -- Complainant who uploaded
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT complaint_evidence_pkey PRIMARY KEY (id),
  CONSTRAINT complaint_evidence_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES dbasakan.complaints(id) ON DELETE CASCADE,
  CONSTRAINT complaint_evidence_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES dbasakan.profiles(id),
  CONSTRAINT complaint_evidence_valid_file_type CHECK (file_type IN ('image', 'audio', 'video'))
);

-- Add comments
COMMENT ON TABLE dbasakan.complaint_evidence IS 'Evidence files (photos, audio, video) attached to complaints. Only visible to syndics.';
COMMENT ON COLUMN dbasakan.complaint_evidence.file_type IS 'Type of file: image, audio, or video';
COMMENT ON COLUMN dbasakan.complaint_evidence.file_size IS 'File size in bytes';

-- ============================================================================
-- PART 2: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_complaint_evidence_complaint_id ON dbasakan.complaint_evidence(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_evidence_uploaded_by ON dbasakan.complaint_evidence(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_complaint_evidence_file_type ON dbasakan.complaint_evidence(file_type);

-- ============================================================================
-- PART 3: ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on complaint_evidence table
ALTER TABLE dbasakan.complaint_evidence ENABLE ROW LEVEL SECURITY;

-- Policy: Only syndics can view evidence (evidence is private to syndics)
DROP POLICY IF EXISTS "Syndics can view complaint evidence" ON dbasakan.complaint_evidence;
CREATE POLICY "Syndics can view complaint evidence" ON dbasakan.complaint_evidence
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND EXISTS (
      SELECT 1 FROM dbasakan.complaints c
      WHERE c.id = complaint_evidence.complaint_id
      AND (c.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
    )
  );

-- Policy: Only residents who filed the complaint can upload evidence
DROP POLICY IF EXISTS "Complainants can upload evidence" ON dbasakan.complaint_evidence;
CREATE POLICY "Complainants can upload evidence" ON dbasakan.complaint_evidence
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'resident'
    )
    AND uploaded_by = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM dbasakan.complaints c
      WHERE c.id = complaint_evidence.complaint_id
      AND c.complainant_id = auth.uid()::text
    )
  );

-- ============================================================================
-- PART 4: GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA dbasakan TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON dbasakan.complaint_evidence TO authenticated;
GRANT ALL ON dbasakan.complaint_evidence TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA dbasakan TO authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================


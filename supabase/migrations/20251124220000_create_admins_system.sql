-- =====================================================
-- ADMINS SYSTEM MIGRATION
-- =====================================================
-- Creates admin table and updates document review system
-- Admins are added directly to database for security
-- Admins can review documents and assign residences to syndics
-- =====================================================

-- Create admins table
CREATE TABLE IF NOT EXISTS dbasakan.admins (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  last_login_at timestamp with time zone,
  is_active boolean DEFAULT true NOT NULL,
  CONSTRAINT admins_id_fkey FOREIGN KEY (id) REFERENCES dbasakan.users(id) ON DELETE CASCADE
);

-- Add comments for documentation
COMMENT ON TABLE dbasakan.admins IS 'System administrators who review syndic documents and assign residences';
COMMENT ON COLUMN dbasakan.admins.id IS 'References users.id - admins must have a user account';
COMMENT ON COLUMN dbasakan.admins.email IS 'Admin email address (must match users table)';
COMMENT ON COLUMN dbasakan.admins.full_name IS 'Full name of the administrator';
COMMENT ON COLUMN dbasakan.admins.is_active IS 'Allows deactivating admin accounts without deleting them';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_admins_email ON dbasakan.admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON dbasakan.admins(is_active);

-- Enable RLS for admins table
ALTER TABLE dbasakan.admins ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can read their own data
CREATE POLICY "Admins can read their own data"
  ON dbasakan.admins
  FOR SELECT
  USING (id = auth.uid()::text);

-- RLS Policy: Active admins can read all admin records
CREATE POLICY "Active admins can read all admins"
  ON dbasakan.admins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.admins
      WHERE id = auth.uid()::text AND is_active = true
    )
  );

-- =====================================================
-- UPDATE DOCUMENT SUBMISSIONS TABLE
-- =====================================================
-- Add columns to track admin review and residence assignment

-- Add reviewed_by column (which admin reviewed the document)
ALTER TABLE dbasakan.syndic_document_submissions
ADD COLUMN IF NOT EXISTS reviewed_by text;

-- Add reviewed_at timestamp
ALTER TABLE dbasakan.syndic_document_submissions
ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone;

-- Add assigned_residence_id (residence assigned upon approval)
ALTER TABLE dbasakan.syndic_document_submissions
ADD COLUMN IF NOT EXISTS assigned_residence_id bigint;

-- Add rejection_reason for better feedback
ALTER TABLE dbasakan.syndic_document_submissions
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Add foreign key constraints (with ON DELETE SET NULL for safety)
ALTER TABLE dbasakan.syndic_document_submissions
DROP CONSTRAINT IF EXISTS syndic_document_submissions_reviewed_by_fkey;

ALTER TABLE dbasakan.syndic_document_submissions
ADD CONSTRAINT syndic_document_submissions_reviewed_by_fkey 
  FOREIGN KEY (reviewed_by) REFERENCES dbasakan.admins(id) ON DELETE SET NULL;

ALTER TABLE dbasakan.syndic_document_submissions
DROP CONSTRAINT IF EXISTS syndic_document_submissions_assigned_residence_id_fkey;

ALTER TABLE dbasakan.syndic_document_submissions
ADD CONSTRAINT syndic_document_submissions_assigned_residence_id_fkey
  FOREIGN KEY (assigned_residence_id) REFERENCES dbasakan.residences(id) ON DELETE SET NULL;

-- Add comments
COMMENT ON COLUMN dbasakan.syndic_document_submissions.reviewed_by IS 'Admin who reviewed the document';
COMMENT ON COLUMN dbasakan.syndic_document_submissions.reviewed_at IS 'When the document was reviewed';
COMMENT ON COLUMN dbasakan.syndic_document_submissions.assigned_residence_id IS 'Residence assigned to syndic upon approval';
COMMENT ON COLUMN dbasakan.syndic_document_submissions.rejection_reason IS 'Reason for document rejection (optional)';

-- Create indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_syndic_documents_status_submitted 
  ON dbasakan.syndic_document_submissions(status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_syndic_documents_reviewed_by 
  ON dbasakan.syndic_document_submissions(reviewed_by);

-- =====================================================
-- EXAMPLE: HOW TO ADD AN ADMIN
-- =====================================================
-- Run these queries manually in Supabase SQL Editor after creating a user account:
-- 
-- 1. First, the admin must sign up normally through the app (Google OAuth)
--    This creates a record in auth.users and dbasakan.users
-- 
-- 2. Get the user's ID from the users table:
--    SELECT id, email, name FROM dbasakan.users WHERE email = 'admin@example.com';
-- 
-- 3. Insert into admins table:
--    INSERT INTO dbasakan.admins (id, email, full_name, is_active)
--    VALUES ('user-id-from-step-2', 'admin@example.com', 'Admin Name', true);
-- 
-- =====================================================


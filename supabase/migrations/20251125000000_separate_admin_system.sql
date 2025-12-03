-- =====================================================
-- SEPARATE ADMIN SYSTEM MIGRATION
-- =====================================================
-- Creates independent admin table not linked to users table
-- Admins have their own authentication and access
-- =====================================================

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Drop existing admin table and recreate as independent
DROP TABLE IF EXISTS dbasakan.admins CASCADE;

-- Create new independent admins table
CREATE TABLE dbasakan.admins (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  last_login_at timestamp with time zone,
  is_active boolean DEFAULT true NOT NULL
);

-- Add comments for documentation
COMMENT ON TABLE dbasakan.admins IS 'Independent admin users - not linked to regular users table';
COMMENT ON COLUMN dbasakan.admins.id IS 'Unique admin ID (UUID)';
COMMENT ON COLUMN dbasakan.admins.email IS 'Admin email for login';
COMMENT ON COLUMN dbasakan.admins.password_hash IS 'Bcrypt hashed password';
COMMENT ON COLUMN dbasakan.admins.full_name IS 'Full name of the administrator';
COMMENT ON COLUMN dbasakan.admins.is_active IS 'Allows deactivating admin accounts';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_admins_email ON dbasakan.admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON dbasakan.admins(is_active);

-- Enable RLS for admins table
ALTER TABLE dbasakan.admins ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role full access (used by admin login API)
-- The service role key bypasses RLS, but we create a permissive policy
-- to ensure both direct queries and RPC functions work properly
CREATE POLICY "Service role full access to admins"
  ON dbasakan.admins
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Update foreign key in syndic_document_submissions
-- First drop the old constraint
ALTER TABLE dbasakan.syndic_document_submissions
DROP CONSTRAINT IF EXISTS syndic_document_submissions_reviewed_by_fkey;

-- Add new constraint pointing to independent admins table
ALTER TABLE dbasakan.syndic_document_submissions
ADD CONSTRAINT syndic_document_submissions_reviewed_by_fkey 
  FOREIGN KEY (reviewed_by) REFERENCES dbasakan.admins(id) ON DELETE SET NULL;

-- =====================================================
-- ADMIN SESSION TABLE
-- =====================================================
-- Store admin sessions separately from NextAuth sessions

CREATE TABLE IF NOT EXISTS dbasakan.admin_sessions (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admin_id text NOT NULL,
  token text UNIQUE NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_sessions_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES dbasakan.admins(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON dbasakan.admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON dbasakan.admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON dbasakan.admin_sessions(expires_at);

COMMENT ON TABLE dbasakan.admin_sessions IS 'Admin authentication sessions - separate from user sessions';

-- Enable RLS
ALTER TABLE dbasakan.admin_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to admin sessions"
  ON dbasakan.admin_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to create admin with hashed password
CREATE OR REPLACE FUNCTION dbasakan.create_admin(
  p_email text,
  p_password text,
  p_full_name text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dbasakan, extensions, pg_temp
AS $$
DECLARE
  v_admin_id text;
  v_password_hash text;
BEGIN
  -- Hash password using pgcrypto
  v_password_hash := crypt(p_password, gen_salt('bf', 10));
  
  -- Insert admin
  INSERT INTO dbasakan.admins (email, password_hash, full_name, is_active)
  VALUES (p_email, v_password_hash, p_full_name, true)
  RETURNING id INTO v_admin_id;
  
  RETURN v_admin_id;
END;
$$;

-- Function to verify admin password
CREATE OR REPLACE FUNCTION dbasakan.verify_admin_password(
  p_email text,
  p_password text
)
RETURNS TABLE(
  admin_id text,
  email text,
  full_name text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dbasakan, extensions, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.email,
    a.full_name,
    a.is_active
  FROM dbasakan.admins a
  WHERE a.email = p_email
    AND a.password_hash = crypt(p_password, a.password_hash)
    AND a.is_active = true;
END;
$$;

-- =====================================================
-- EXAMPLE: HOW TO CREATE AN ADMIN
-- =====================================================
-- Run this in Supabase SQL Editor:
-- 
-- SELECT dbasakan.create_admin(
--   'admin@example.com',
--   'SecurePassword123!',
--   'Admin Full Name'
-- );
-- 
-- This will return the admin ID
-- =====================================================

-- =====================================================
-- EXAMPLE: HOW TO VERIFY ADMIN LOGIN
-- =====================================================
-- SELECT * FROM dbasakan.verify_admin_password(
--   'admin@example.com',
--   'SecurePassword123!'
-- );
-- 
-- Returns admin data if password matches, empty if not
-- =====================================================


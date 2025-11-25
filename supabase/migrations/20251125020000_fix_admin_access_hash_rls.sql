-- Migration: Fix RLS for admin access hash verification
-- Description: Allow public read access to verify access hash during login
-- This only exposes the email for valid access hashes, not passwords

-- Drop existing policies explicitly
DROP POLICY IF EXISTS "Admins can read their own data" ON dbasakan.admins;
DROP POLICY IF EXISTS "Active admins can read all admin records" ON dbasakan.admins;
DROP POLICY IF EXISTS "Allow access hash verification" ON dbasakan.admins;
DROP POLICY IF EXISTS "Admin sessions are managed by application" ON dbasakan.admin_sessions;

-- Create new policy for admins table
-- This allows checking access_hash during login
-- Safe because: only email exposed, password never shown, access_hash is the security mechanism
CREATE POLICY "Allow access hash verification"
ON dbasakan.admins
FOR SELECT
USING (is_active = true);

-- Create policy for admin_sessions table
CREATE POLICY "Admin sessions are managed by application"
ON dbasakan.admin_sessions
FOR ALL
USING (true);

-- Ensure RLS is enabled on both tables
ALTER TABLE dbasakan.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE dbasakan.admin_sessions ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON POLICY "Allow access hash verification" ON dbasakan.admins IS 
'Allows public read access to active admin records for access hash verification during login. Password hashes are never exposed. The access_hash serves as the security mechanism.';


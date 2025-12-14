-- ============================================================================
-- Simple Admin Insert (No Functions Required)
-- ============================================================================
-- This script creates an admin user without requiring any functions
-- ============================================================================

-- IMPORTANT: Replace these values before running:
-- 1. 'admin@example.com' - Your admin email
-- 2. 'YourSecurePassword123!' - Your admin password
-- 3. 'Admin Name' - Admin's full name

INSERT INTO dbasakan.admins (
  email,
  password_hash,
  full_name,
  is_active,
  access_hash
)
VALUES (
  'admin@example.com',                                                    -- Email
  crypt('YourSecurePassword123!', gen_salt('bf', 10)),                    -- Password (hashed)
  'Admin Name',                                                           -- Full name
  true,                                                                   -- Is active
  substr(md5(random()::text || clock_timestamp()::text), 1, 12)         -- Access hash (12 chars)
)
RETURNING 
  id,
  email,
  full_name,
  access_hash,
  is_active,
  created_at;

-- ============================================================================
-- After Insert: Get Your Login Details
-- ============================================================================

-- Your login URL will be: /admin/{access_hash}
-- Example: If access_hash is "abc123def456", login at: /admin/abc123def456

-- To see your access hash:
SELECT 
  email,
  access_hash,
  '/admin/' || access_hash as login_url
FROM dbasakan.admins
WHERE email = 'admin@example.com';

-- ============================================================================
-- Quick Copy-Paste Template
-- ============================================================================

/*
INSERT INTO dbasakan.admins (email, password_hash, full_name, is_active, access_hash)
VALUES (
  'your-email@example.com',
  crypt('YourPassword', gen_salt('bf', 10)),
  'Your Name',
  true,
  substr(md5(random()::text || clock_timestamp()::text), 1, 12)
)
RETURNING id, email, access_hash;
*/


-- ============================================================================
-- Insert Admin User - SQL Scripts
-- ============================================================================
-- This file provides multiple ways to create an admin user
-- ============================================================================

-- ============================================================================
-- OPTION 1: Using the create_admin_with_hash function (RECOMMENDED)
-- ============================================================================
-- This function handles password hashing and access hash generation automatically
-- Returns: admin_id, access_hash, and login_url

-- First, ensure the function exists (if not, see OPTION 2)
SELECT * FROM dbasakan.create_admin_with_hash(
  'admin@example.com',        -- p_email: Admin email address
  'YourSecurePassword123!',   -- p_password: Admin password (will be hashed)
  'Admin User'                -- p_full_name: Admin full name
);

-- Example output:
-- admin_id: "550e8400-e29b-41d4-a716-446655440000"
-- access_hash: "abc123def456"
-- login_url: "http://localhost:3000/admin/abc123def456"

-- ============================================================================
-- OPTION 2: Direct INSERT (Manual - requires password hashing)
-- ============================================================================
-- Use this if the function doesn't exist or you need more control

-- Step 1: Generate access hash (12 character alphanumeric)
-- You can use this function or generate manually:
SELECT dbasakan.generate_admin_hash() as access_hash;

-- Step 2: Insert admin with hashed password
-- Replace these values:
-- - 'admin@example.com' with your admin email
-- - 'YourSecurePassword123!' with your desired password
-- - 'Admin User' with admin's full name
-- - 'abc123def456' with the access_hash from Step 1

INSERT INTO dbasakan.admins (
  email,
  password_hash,
  full_name,
  is_active,
  access_hash
)
VALUES (
  'admin@example.com',
  crypt('YourSecurePassword123!', gen_salt('bf', 10)),  -- Password will be hashed
  'Admin User',
  true,
  'abc123def456'  -- Replace with generated access_hash
)
RETURNING id, email, full_name, access_hash, created_at;

-- ============================================================================
-- OPTION 3: Quick Insert with All Defaults
-- ============================================================================
-- Minimal insert (uses defaults for id, created_at, is_active)

INSERT INTO dbasakan.admins (
  email,
  password_hash,
  full_name,
  access_hash
)
VALUES (
  'admin@example.com',
  crypt('YourSecurePassword123!', gen_salt('bf', 10)),
  'Admin User',
  substr(md5(random()::text || clock_timestamp()::text), 1, 12)  -- Simple hash generation
)
RETURNING *;

-- ============================================================================
-- VERIFY ADMIN WAS CREATED
-- ============================================================================

SELECT 
  id,
  email,
  full_name,
  is_active,
  access_hash,
  created_at
FROM dbasakan.admins
WHERE email = 'admin@example.com';

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. Password Requirements:
--    - Use a strong password (the crypt function will hash it)
--    - Minimum 8 characters recommended
--
-- 2. Access Hash:
--    - Must be unique (12 character alphanumeric)
--    - Used in admin login URL: /admin/{access_hash}
--    - Example: /admin/abc123def456
--
-- 3. Login:
--    - Email: The email you inserted
--    - Password: The plain text password (before hashing)
--    - Access Hash: The access_hash value
--
-- 4. Security:
--    - Never store plain text passwords
--    - The password_hash column stores bcrypt hashed passwords
--    - Access hash should be kept secret
--
-- ============================================================================
-- EXAMPLE: Create Admin with Specific Values
-- ============================================================================

-- Replace these values with your actual admin details:
/*
SELECT * FROM dbasakan.create_admin_with_hash(
  'admin@sakan.com',
  'MySecurePassword2024!',
  'John Doe'
);
*/

-- After running, you'll get:
-- - admin_id: Use this to reference the admin
-- - access_hash: Use this in the login URL (/admin/{access_hash})
-- - login_url: Full login URL


# Admin Access Hash System

## Overview

Each admin has a unique access hash that must be used in the URL to access their login page. This adds an extra layer of security by obscuring the admin login endpoints.

## How It Works

### Old System
```
Everyone uses: /admin/login
```

### New System
```
Admin 1 uses: /admin/abc123xyz456
Admin 2 uses: /admin/def789ghi012
Admin 3 uses: /admin/jkl345mno678
```

Each admin gets a unique 12-character alphanumeric hash that serves as their personal login endpoint.

## Setup

### 1. Apply the Migration

```bash
npx supabase db push
```

This migration:
- Adds `access_hash` column to `admins` table
- Creates functions to generate random hashes
- Backfills existing admins with hashes
- Updates admin creation functions

### 2. Create Admin with Access Hash

```sql
-- Method 1: Get full details including URL
SELECT * FROM dbasakan.create_admin_with_hash(
  'admin@example.com',
  'SecurePassword123!',
  'Admin Name'
);

-- Returns:
-- admin_id: '123e4567-e89b-...'
-- access_hash: 'abc123xyz456'
-- login_url: 'http://localhost:3000/admin/abc123xyz456'
```

```sql
-- Method 2: Simple creation (still generates hash)
SELECT dbasakan.create_admin(
  'admin@example.com',
  'SecurePassword123!',
  'Admin Name'
);

-- Then get the hash:
SELECT access_hash FROM dbasakan.admins WHERE email = 'admin@example.com';
```

### 3. Share URL with Admin

When you create an admin, share their unique URL:

```
Your admin login URL is:
https://yourdomain.com/admin/abc123xyz456

Email: admin@example.com
Password: [the password you set]

⚠️ Keep this URL private - it's unique to you!
```

## Security Benefits

### ✅ Obscurity
- No public `/admin/login` endpoint
- Harder for attackers to find admin login
- Each admin has different URL

### ✅ Access Control
- Hash validates before showing login form
- Invalid hashes redirect to 404
- Inactive admins can't access even with correct hash

### ✅ Traceability
- Can track which admin URL is being used
- Can revoke access by regenerating hash
- Each admin's access is independent

## Admin Management

### List All Admins with URLs

```sql
SELECT 
  id,
  email,
  full_name,
  access_hash,
  is_active,
  'https://yourdomain.com/admin/' || access_hash as login_url,
  created_at
FROM dbasakan.admins
ORDER BY created_at DESC;
```

### Get Specific Admin's URL

```sql
SELECT 
  email,
  'https://yourdomain.com/admin/' || access_hash as login_url
FROM dbasakan.admins
WHERE email = 'admin@example.com';
```

### Regenerate Admin's Access Hash

If an admin's URL is compromised, regenerate it:

```sql
-- Get admin ID first
SELECT id FROM dbasakan.admins WHERE email = 'admin@example.com';

-- Regenerate hash
SELECT dbasakan.regenerate_admin_hash('admin-id-here');

-- Get new URL
SELECT 
  email,
  'https://yourdomain.com/admin/' || access_hash as new_login_url
FROM dbasakan.admins
WHERE email = 'admin@example.com';
```

### Deactivate Admin

```sql
-- This will make their URL invalid
UPDATE dbasakan.admins
SET is_active = false
WHERE email = 'admin@example.com';
```

## URL Format

### Pattern
```
/admin/{12-character-hash}
```

### Valid Examples
```
/admin/abc123xyz456  ✅
/admin/h8k2m9p4q7w3  ✅
/admin/x5z9a2c4e6g8  ✅
```

### Invalid Examples
```
/admin/ABC123  ❌ (too short)
/admin/abc-123  ❌ (contains dash)
/admin/ABC123XYZ456  ❌ (uppercase)
```

### Hash Characteristics
- Length: Exactly 12 characters
- Characters: Lowercase letters (a-z) and numbers (0-9)
- Unique: No two admins can have the same hash
- Random: Generated cryptographically

## Login Flow

```
1. Admin visits /admin/abc123xyz456
   ↓
2. System checks if hash exists and admin is active
   ↓
3. If valid → Show login form (email pre-filled)
   ↓
4. If invalid → Redirect to 404
   ↓
5. Admin enters password
   ↓
6. System verifies:
   - Email matches access hash ✓
   - Password is correct ✓
   - Admin is active ✓
   ↓
7. Success → Redirect to /admin dashboard
```

## Migration from Old System

Existing admins will automatically get hashes assigned:

```sql
-- Check existing admins
SELECT 
  email,
  access_hash,
  CASE 
    WHEN access_hash IS NOT NULL THEN '✅ Has hash'
    ELSE '❌ Missing hash'
  END as status
FROM dbasakan.admins;
```

All existing admins will have hashes after migration.

## Best Practices

### ✅ Do
- Share URLs privately (email, secure messaging)
- Regenerate hashes if compromised
- Keep access URLs confidential
- Use HTTPS in production
- Store URLs in password managers

### ❌ Don't
- Share URLs publicly
- Use the same hash for multiple admins (impossible anyway)
- Hard-code hashes in client code
- Share URLs over unsecured channels

## Troubleshooting

### Admin Can't Access Their URL

```sql
-- Check admin status
SELECT 
  email,
  access_hash,
  is_active,
  'https://yourdomain.com/admin/' || access_hash as login_url
FROM dbasakan.admins
WHERE email = 'admin@example.com';
```

Possible issues:
- Admin is inactive (`is_active = false`)
- Access hash is incorrect
- URL typo

### Need to Reset Admin Access

```sql
-- Regenerate hash
SELECT dbasakan.regenerate_admin_hash(
  (SELECT id FROM dbasakan.admins WHERE email = 'admin@example.com')
);

-- Get new URL
SELECT 'https://yourdomain.com/admin/' || access_hash as new_url
FROM dbasakan.admins
WHERE email = 'admin@example.com';
```

### Check If Hash Is Valid

```sql
SELECT 
  email,
  full_name,
  is_active
FROM dbasakan.admins
WHERE access_hash = 'abc123xyz456';
```

If no results, the hash doesn't exist.

## API Endpoints

### GET `/admin/{accessHash}`
- Shows login page if hash is valid
- Redirects to 404 if hash is invalid
- Pre-fills email for convenience

### POST `/api/admin/auth/login`
Requires:
```json
{
  "email": "admin@example.com",
  "password": "password",
  "accessHash": "abc123xyz456"
}
```

Validates:
1. Email matches access hash
2. Password is correct
3. Admin is active

## Example: Complete Admin Setup

```sql
-- 1. Create admin and get URL
SELECT * FROM dbasakan.create_admin_with_hash(
  'john@example.com',
  'SecurePass123!',
  'John Doe'
);

-- Output:
-- admin_id: 550e8400-e29b-41d4-a716-446655440000
-- access_hash: h8k2m9p4q7w3
-- login_url: http://localhost:3000/admin/h8k2m9p4q7w3

-- 2. Share with John:
--    "Your admin URL: https://sakan.app/admin/h8k2m9p4q7w3"
--    "Email: john@example.com"
--    "Password: SecurePass123!"

-- 3. John can now login at that unique URL
```

This system significantly increases security by making admin login endpoints unpredictable and unique per admin! 🔒


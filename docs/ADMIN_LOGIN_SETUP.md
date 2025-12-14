# Admin Login System - Setup Guide

## Overview

The admin system now has its own independent authentication using email/password, completely separate from the user OAuth system.

## Setup Steps

### 1. Add Environment Variable

Add this to your `.env.local`:

```bash
# Admin JWT Secret (generate with: openssl rand -base64 32)
ADMIN_JWT_SECRET=your-secret-key-here
```

Generate a secure secret:
```bash
openssl rand -base64 32
```

### 2. Apply the Migration

```bash
npx supabase db push
```

This creates:
- Independent `admins` table
- `admin_sessions` table for session management
- Helper functions for password hashing and verification

### 3. Create Your First Admin

Run this in Supabase SQL Editor:

```sql
SELECT dbasakan.create_admin(
  'admin@example.com',
  'YourSecurePassword123!',
  'Admin Full Name'
);
```

### 4. Test Login

1. Go to: `http://localhost:3000/admin/login`
2. Enter email and password
3. Click "Se connecter"
4. You'll be redirected to `/admin` dashboard

## Features

### Login Page
- Clean, modern design
- Email + password authentication
- Error handling
- Loading states
- Secure password input

### Authentication System
- ✅ **Independent from users** - No relation to OAuth users
- ✅ **Bcrypt password hashing** - Secure password storage
- ✅ **JWT tokens** - Secure session management
- ✅ **Database sessions** - Track active sessions
- ✅ **7-day expiration** - Auto logout after 7 days
- ✅ **HttpOnly cookies** - Protect against XSS attacks

### Middleware Protection
- All `/admin/*` routes require authentication
- `/admin/login` is publicly accessible
- Invalid/expired sessions redirect to login
- Inactive admins cannot access

## Admin Management

### Create Admin
```sql
SELECT dbasakan.create_admin(
  'email@example.com',
  'password',
  'Full Name'
);
```

### Verify Login
```sql
SELECT * FROM dbasakan.verify_admin_password(
  'email@example.com',
  'password'
);
```

### List All Admins
```sql
SELECT 
  id,
  email,
  full_name,
  is_active,
  created_at,
  last_login_at
FROM dbasakan.admins
ORDER BY created_at DESC;
```

### Deactivate Admin
```sql
UPDATE dbasakan.admins
SET is_active = false
WHERE email = 'email@example.com';
```

### Change Password
```sql
UPDATE dbasakan.admins
SET password_hash = crypt('NewPassword123!', gen_salt('bf', 10))
WHERE email = 'email@example.com';
```

### Delete Admin
```sql
DELETE FROM dbasakan.admins
WHERE email = 'email@example.com';
```

## Security Features

### Password Requirements
- Stored as bcrypt hash
- Salt generated per password
- Never stored in plain text

### Session Security
- HttpOnly cookies (not accessible via JavaScript)
- Secure flag in production (HTTPS only)
- SameSite protection
- 7-day automatic expiration
- Database-backed sessions (can revoke)

### Middleware Protection
- Checks session on every request
- Validates session expiration
- Verifies admin is active
- Redirects to login if invalid

## Troubleshooting

### Can't Login
Check:
1. Email is correct
2. Password is correct
3. Admin account exists: `SELECT * FROM dbasakan.admins WHERE email = 'your-email'`
4. Admin is active: `is_active = true`
5. Session table is accessible

### Stuck on Login Page
Check:
1. `ADMIN_JWT_SECRET` is set in `.env.local`
2. Migration was applied successfully
3. Browser cookies are enabled
4. Check browser console for errors

### Session Expired
- Sessions last 7 days
- Login again to get a new session
- Old sessions are automatically cleaned up

## API Endpoints

### POST `/api/admin/auth/login`
```json
{
  "email": "admin@example.com",
  "password": "password"
}
```

Response:
```json
{
  "success": true,
  "admin": {
    "id": "uuid",
    "email": "admin@example.com",
    "fullName": "Admin Name"
  }
}
```

### POST `/api/admin/auth/logout`
- Deletes session from database
- Clears admin_session cookie
- Redirects to login

## Files Created

- `app/admin/login/page.tsx` - Login page
- `components/admin/AdminLoginForm.tsx` - Login form component
- `app/api/admin/auth/login/route.ts` - Login API
- `app/api/admin/auth/logout/route.ts` - Logout API
- `lib/admin-auth.ts` - Auth helper functions
- `supabase/migrations/20251125000000_separate_admin_system.sql` - Database migration

## Flow Diagram

```
User visits /admin
    ↓
Middleware checks admin_session cookie
    ↓
No cookie? → Redirect to /admin/login
    ↓
User enters email + password
    ↓
API verifies credentials with database
    ↓
Valid? → Create session + Set cookie → Redirect to /admin
    ↓
Invalid? → Show error message
```

## Next Steps

1. Apply the migration
2. Create admin accounts
3. Test login at `/admin/login`
4. Admins can now manage documents and residences!


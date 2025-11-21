# Supabase NextAuth Setup - Quick Fix

## The Problem
The error shows: `Could not find the table 'dbasakan.accounts' in the schema cache`

This means the NextAuth tables are missing from your `dbasakan` schema.

## The Solution

You need to run the migration to create **ONLY** the NextAuth tables. This will **NOT** affect your existing tables like `profiles`, `residences`, `fees`, etc.

### Step 1: Run the Migration

1. Go to your **Supabase Dashboard** → **SQL Editor**
2. Copy the **entire contents** of `supabase/migrations/20241120000000_nextauth_schema.sql`
3. Paste into the SQL Editor
4. Click **Run**

This will create 4 new tables in `dbasakan`:
- `dbasakan.users` (NextAuth users - separate from `auth.users` and `dbasakan.profiles`)
- `dbasakan.accounts` (OAuth accounts like Google)
- `dbasakan.sessions` (User sessions)
- `dbasakan.verification_tokens` (Email verification)

### Step 2: Verify Schema is Exposed (Important!)

Supabase needs to expose the `dbasakan` schema in the API:

1. Go to **Project Settings** → **API**
2. Scroll to **Schema Visibility** or **Exposed Schemas**
3. Make sure `dbasakan` is listed (add it if not)
4. If you can't find this setting, the migration should handle it via `GRANT USAGE`

Alternatively, you can run this SQL to ensure the schema is accessible:

```sql
-- Ensure dbasakan schema is accessible via API
ALTER DATABASE postgres SET search_path TO public, dbasakan;
```

### Step 3: Verify Tables Exist

Run this query to verify the tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'dbasakan' 
AND table_name IN ('users', 'accounts', 'sessions', 'verification_tokens')
ORDER BY table_name;
```

You should see all 4 tables.

### Step 4: Check Environment Variables

Ensure your `.env.local` has:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your_service_role_key  # CRITICAL - must be service_role key
SUPABASE_JWT_SECRET=your_jwt_secret
AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_client_secret
AUTH_SECRET=your_auth_secret
```

**Important**: `SUPABASE_SECRET_KEY` must be the **service_role** key (not anon key) for NextAuth to bypass RLS.

### Step 5: Restart Your Dev Server

After running the migration:
```bash
# Stop your dev server (Ctrl+C)
# Then restart
npm run dev
# or
pnpm dev
```

## What This Migration Does

✅ Creates ONLY NextAuth tables (users, accounts, sessions, verification_tokens)  
✅ Uses `IF NOT EXISTS` - safe to run multiple times  
✅ Does NOT modify existing tables (profiles, residences, fees, etc.)  
✅ Does NOT conflict with `auth.users` or `dbasakan.profiles`  
✅ Grants proper permissions to service_role  
✅ Sets up RLS policies for NextAuth  

## Troubleshooting

If you still get errors after running the migration:

1. **Check the error message** - The improved error handling will show exactly what's wrong
2. **Verify service_role key** - Must use `SUPABASE_SECRET_KEY` (service_role), not anon key
3. **Check schema exposure** - Ensure `dbasakan` schema is accessible via API
4. **Clear Next.js cache**: `rm -rf .next` then restart dev server

## Notes

- NextAuth's `dbasakan.users` is **separate** from:
  - `auth.users` (Supabase Auth)
  - `dbasakan.profiles` (Your app's user profiles)
- These tables only handle NextAuth session management and OAuth
- Your existing app tables remain untouched

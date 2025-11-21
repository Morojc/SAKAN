# Database Migrations - Standard Operating Procedure

## Related Docs
- [Database Schema](../System/database_schema.md)
- [Project Architecture](../System/project_architecture.md)
- [Supabase Integration](./supabase_integration.md)

## Overview

This guide covers how to create, test, and apply database migrations for the SAKAN project. All database changes should be done through migrations to ensure consistency across environments.

## Migration Location

**Directory**: `supabase/migrations/`  
**Naming Convention**: `YYYYMMDDHHMMSS_description.sql`  
**Example**: `20241120000000_nextauth_schema.sql`

## Creating a New Migration

### Step 1: Create Migration File

Create a new SQL file in `supabase/migrations/` with a timestamp prefix:

```bash
# Format: YYYYMMDDHHMMSS_description.sql
# Example: 20241121120000_add_notifications_table.sql
```

### Step 2: Write Migration SQL

Follow these guidelines from `.cursor/rules/create_supabase_table.mdc`:

#### Table Creation Rules
- Use `dbasakan` schema (not `public`)
- Always add `id` column with `bigint generated always as identity primary key`
- Use `IF NOT EXISTS` for idempotency
- Add table comments describing purpose
- Use singular table names
- Use lowercase for column names
- Foreign keys: use `_id` suffix (e.g., `user_id`, `residence_id`)

#### Example Migration

```sql
-- Migration: Add notifications table
-- Date: 2024-11-21
-- Description: Track resident notifications

CREATE TABLE IF NOT EXISTS dbasakan.notifications (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  user_id uuid references dbasakan.profiles(id) not null,
  title text not null,
  content text not null,
  type text not null, -- 'announcement', 'payment', 'incident'
  read_at timestamptz,
  created_at timestamptz default now()
);

COMMENT ON TABLE dbasakan.notifications IS 'Resident notification tracking for announcements, payments, and incidents';

-- Enable RLS
ALTER TABLE dbasakan.notifications ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON TABLE dbasakan.notifications TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE dbasakan.notifications_id_seq TO anon, authenticated, service_role;

-- Add RLS policies
CREATE POLICY "Users can view own notifications" ON dbasakan.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Syndics can view all residence notifications" ON dbasakan.notifications
  FOR SELECT
  USING (
    exists (
      select 1 from dbasakan.profiles
      where id = auth.uid() 
      and role = 'syndic' 
      and residence_id = notifications.residence_id
    )
  );

-- Add index for performance
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON dbasakan.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_residence_id_idx ON dbasakan.notifications(residence_id);
```

### Step 3: Include Rollback (Optional but Recommended)

For critical migrations, include rollback SQL as comments:

```sql
-- Rollback (if needed):
-- DROP TABLE IF EXISTS dbasakan.notifications;
-- DROP POLICY IF EXISTS "Users can view own notifications" ON dbasakan.notifications;
-- DROP POLICY IF EXISTS "Syndics can view all residence notifications" ON dbasakan.notifications;
```

## Applying Migrations

### Method 1: Supabase Dashboard (Recommended for Development)

1. Open [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New query**
5. Copy the entire migration file content
6. Paste into SQL Editor
7. Click **Run** or press `Ctrl+Enter`
8. Verify success message

**PowerShell Helper**: Run `.\run-migration.ps1` to copy migration to clipboard

### Method 2: Supabase CLI (For Production)

If you have Supabase CLI installed:

```bash
# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push

# Or apply specific migration
supabase migration up
```

### Method 3: Direct SQL Execution

For production or when CLI is not available:
1. Export migration SQL
2. Execute via Supabase Dashboard SQL Editor
3. Or use `psql` if you have direct database access

## Migration Best Practices

### 1. Idempotency
Always use `IF NOT EXISTS` and `IF EXISTS` to make migrations safe to run multiple times:

```sql
CREATE TABLE IF NOT EXISTS ...
CREATE INDEX IF NOT EXISTS ...
DROP POLICY IF EXISTS ...
```

### 2. Schema Specification
Always specify `dbasakan` schema explicitly:

```sql
-- Good
CREATE TABLE dbasakan.notifications (...)

-- Bad (creates in public schema)
CREATE TABLE notifications (...)
```

### 3. Foreign Key Constraints
Always add foreign key constraints with appropriate `ON DELETE` behavior:

```sql
-- Cascade delete
user_id uuid references dbasakan.profiles(id) on delete cascade

-- Set null
residence_id bigint references dbasakan.residences(id) on delete set null

-- Restrict (default)
fee_id bigint references dbasakan.fees(id)
```

### 4. RLS Policies
Always enable RLS and create appropriate policies:

```sql
ALTER TABLE dbasakan.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policy_name" ON dbasakan.notifications
  FOR SELECT  -- or INSERT, UPDATE, DELETE, or ALL
  TO authenticated  -- or anon, service_role
  USING (condition);  -- for SELECT/UPDATE/DELETE
  WITH CHECK (condition);  -- for INSERT/UPDATE
```

### 5. Permissions
Grant necessary permissions:

```sql
GRANT ALL ON TABLE dbasakan.notifications TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE dbasakan.notifications_id_seq TO anon, authenticated, service_role;
```

### 6. Indexes
Add indexes on foreign keys and frequently queried columns:

```sql
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON dbasakan.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_residence_id_idx ON dbasakan.notifications(residence_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON dbasakan.notifications(created_at);
```

### 7. Comments
Add table and column comments for documentation:

```sql
COMMENT ON TABLE dbasakan.notifications IS 'Resident notification tracking';
COMMENT ON COLUMN dbasakan.notifications.type IS 'Notification type: announcement, payment, incident';
```

## Testing Migrations

### Before Applying to Production

1. **Test in Development**: Apply to dev Supabase project first
2. **Verify Schema**: Check that tables, columns, and constraints are correct
3. **Test RLS**: Verify policies work as expected
4. **Test Queries**: Run sample queries to ensure indexes work
5. **Check Permissions**: Verify role permissions are correct

### Verification Queries

```sql
-- Check table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'dbasakan' 
AND table_name = 'notifications';

-- Check columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'dbasakan' 
AND table_name = 'notifications'
ORDER BY ordinal_position;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'dbasakan' 
AND tablename = 'notifications';

-- Check policies
SELECT policyname, cmd, roles, qual 
FROM pg_policies 
WHERE schemaname = 'dbasakan' 
AND tablename = 'notifications';

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'dbasakan' 
AND tablename = 'notifications';
```

## Common Migration Patterns

### Adding a New Table
See example above in "Step 2: Write Migration SQL"

### Adding a Column

```sql
ALTER TABLE dbasakan.profiles 
ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN dbasakan.profiles.avatar_url IS 'User profile avatar URL';
```

### Modifying a Column

```sql
-- Change column type (be careful with data loss)
ALTER TABLE dbasakan.fees 
ALTER COLUMN status TYPE text USING status::text;

-- Add NOT NULL constraint (ensure no nulls first)
ALTER TABLE dbasakan.fees 
ALTER COLUMN status SET NOT NULL;
```

### Adding a Foreign Key

```sql
ALTER TABLE dbasakan.payments 
ADD CONSTRAINT payments_fee_id_fkey 
FOREIGN KEY (fee_id) 
REFERENCES dbasakan.fees(id) 
ON DELETE SET NULL;
```

### Creating an Enum Type

```sql
CREATE TYPE IF NOT EXISTS dbasakan.notification_type AS ENUM (
  'announcement', 
  'payment', 
  'incident', 
  'poll'
);

-- Use in table
ALTER TABLE dbasakan.notifications 
ALTER COLUMN type TYPE dbasakan.notification_type 
USING type::dbasakan.notification_type;
```

## Troubleshooting

### Migration Fails: Table Already Exists
- Use `IF NOT EXISTS` in CREATE TABLE
- Or check if migration was already applied

### Migration Fails: Permission Denied
- Ensure you're using service_role key or have proper permissions
- Check schema grants: `GRANT USAGE ON SCHEMA dbasakan TO ...`

### RLS Policy Conflicts
- Drop existing policies first: `DROP POLICY IF EXISTS ...`
- Then create new policies

### Foreign Key Violations
- Ensure referenced data exists
- Check ON DELETE behavior matches requirements
- Consider data migration before adding constraints

## Updating TypeScript Types

After applying migration:

1. Generate new types from Supabase:
   ```bash
   # If using Supabase CLI
   supabase gen types typescript --project-id your-project-id > types/database.types.ts
   ```

2. Or use Supabase Dashboard:
   - Go to Settings → API
   - Copy TypeScript types
   - Update `types/database.types.ts`

3. Restart TypeScript server in IDE
4. Fix any type errors in code

## Migration Checklist

Before committing a migration:

- [ ] Migration file named with timestamp
- [ ] Uses `IF NOT EXISTS` / `IF EXISTS` for idempotency
- [ ] Specifies `dbasakan` schema explicitly
- [ ] Includes RLS policies
- [ ] Grants proper permissions
- [ ] Adds necessary indexes
- [ ] Includes table/column comments
- [ ] Tested in development environment
- [ ] TypeScript types updated
- [ ] Documentation updated if schema changes are significant

---

*Follow this SOP for all database schema changes to maintain consistency and safety.*


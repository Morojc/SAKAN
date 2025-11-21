# SAKAN Database Schema

## Related Docs
- [Project Architecture](./project_architecture.md)
- [SOP: Database Migrations](../SOP/database_migrations.md)
- [SOP: Supabase Integration](../SOP/supabase_integration.md)

## Schema Overview

**Schema Name**: `dbasakan`  
**Database**: PostgreSQL (Supabase)  
**Migration File**: `supabase/migrations/20241120000000_nextauth_schema.sql`

The database uses a custom schema `dbasakan` (separate from `public` and `auth` schemas) to organize all application tables. This schema includes both application tables and NextAuth authentication tables.

## Enums

### `dbasakan.user_role`
User role types in the system.
```sql
'syndic'    -- Property manager/admin
'resident'  -- Building resident
'guard'     -- Security personnel
```

### `dbasakan.payment_method`
Payment method types.
```sql
'cash'           -- Cash payment
'bank_transfer'  -- Bank transfer
'online_card'    -- Online card payment
'check'          -- Check payment
```

### `dbasakan.payment_status`
Payment status values.
```sql
'pending'    -- Payment pending verification
'completed'  -- Payment confirmed
'rejected'   -- Payment rejected
```

### `dbasakan.incident_status`
Incident/ticket status values.
```sql
'open'         -- Newly reported
'in_progress'  -- Being worked on
'resolved'     -- Issue fixed
'closed'       -- Ticket closed
```

## Application Tables

### `dbasakan.residences`
Stores building/residence information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `bigint` | PK, Identity | Auto-generated ID |
| `created_at` | `timestamptz` | Default: now() | Creation timestamp |
| `name` | `text` | NOT NULL | Building name |
| `address` | `text` | NOT NULL | Street address |
| `city` | `text` | NOT NULL | City |
| `bank_account_rib` | `text` | | Bank account RIB (IBAN) |
| `syndic_user_id` | `text` | FK → `dbasakan.users(id)` | Main admin/syndic |

**Relationships**:
- One-to-many with `profiles` (residents)
- One-to-many with `fees`, `payments`, `expenses`, `incidents`, `announcements`, `polls`, `access_logs`, `deliveries`

### `dbasakan.profiles`
Extended user profiles linking to NextAuth Users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `text` | PK, FK → `dbasakan.users(id)` | User ID (matches dbasakan.users) |
| `created_at` | `timestamptz` | Default: now() | Creation timestamp |
| `residence_id` | `bigint` | FK → `residences(id)`, ON DELETE SET NULL | Associated residence |
| `full_name` | `text` | NOT NULL | User's full name |
| `apartment_number` | `text` | | Apartment/unit number |
| `phone_number` | `text` | | Contact phone |
| `role` | `user_role` | NOT NULL, Default: 'resident' | User role enum |

**Comment**: Extended user data linking to NextAuth users. Stores name, role, and apartment info.

**Relationships**:
- One-to-one with `dbasakan.users` (NextAuth)
- Many-to-one with `residences`
- One-to-many with `fees`, `payments` (as user_id)
- Referenced by `payments.verified_by`, `expenses.created_by`, `incidents.user_id`, `incidents.assigned_to`, etc.

### `dbasakan.fees`
Monthly/periodic fees (Appels de fonds) for residents.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `bigint` | PK, Identity | Auto-generated ID |
| `residence_id` | `bigint` | FK → `residences(id)`, NOT NULL | Associated residence |
| `user_id` | `text` | FK → `profiles(id)`, NOT NULL | Resident who owes the fee |
| `title` | `text` | NOT NULL | Fee title (e.g., "Frais de Mars 2024") |
| `amount` | `numeric(10,2)` | NOT NULL | Fee amount |
| `due_date` | `date` | NOT NULL | Payment due date |
| `status` | `text` | NOT NULL, Default: 'unpaid' | Payment status |
| `created_at` | `timestamptz` | Default: now() | Creation timestamp |

**Relationships**:
- Many-to-one with `residences`
- Many-to-one with `profiles` (resident)
- One-to-many with `payments` (optional link via `fee_id`)

### `dbasakan.payments`
Payment records for fees and charges.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `bigint` | PK, Identity | Auto-generated ID |
| `residence_id` | `bigint` | FK → `residences(id)`, NOT NULL | Associated residence |
| `user_id` | `text` | FK → `profiles(id)`, NOT NULL | Resident who made payment |
| `fee_id` | `bigint` | FK → `fees(id)` | Optional link to specific fee |
| `amount` | `numeric(10,2)` | NOT NULL | Payment amount |
| `method` | `payment_method` | NOT NULL | Payment method enum |
| `status` | `payment_status` | NOT NULL, Default: 'pending' | Payment status |
| `proof_url` | `text` | | Receipt/image URL |
| `paid_at` | `timestamptz` | Default: now() | Payment timestamp |
| `verified_by` | `text` | FK → `profiles(id)` | Syndic who verified (for cash) |

**Relationships**:
- Many-to-one with `residences`
- Many-to-one with `profiles` (payer)
- Many-to-one with `fees` (optional)
- Many-to-one with `profiles` (verifier)

### `dbasakan.expenses`
Building maintenance and operational expenses (Dépenses).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `bigint` | PK, Identity | Auto-generated ID |
| `residence_id` | `bigint` | FK → `residences(id)`, NOT NULL | Associated residence |
| `description` | `text` | NOT NULL | Expense description |
| `category` | `text` | NOT NULL | Category (e.g., 'Electricity', 'Cleaning') |
| `amount` | `numeric(10,2)` | NOT NULL | Expense amount |
| `attachment_url` | `text` | | Invoice/image URL |
| `expense_date` | `date` | NOT NULL | Date of expense |
| `created_by` | `text` | FK → `profiles(id)`, Default: auth.uid() | Creator (syndic) |
| `created_at` | `timestamptz` | Default: now() | Creation timestamp |

**Relationships**:
- Many-to-one with `residences`
- Many-to-one with `profiles` (creator)

### `dbasakan.incidents`
Maintenance requests and incident reports.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `bigint` | PK, Identity | Auto-generated ID |
| `residence_id` | `bigint` | FK → `residences(id)`, NOT NULL | Associated residence |
| `user_id` | `text` | FK → `profiles(id)`, NOT NULL | Reporter |
| `title` | `text` | NOT NULL | Incident title |
| `description` | `text` | NOT NULL | Detailed description |
| `photo_url` | `text` | | Photo evidence URL |
| `status` | `incident_status` | NOT NULL, Default: 'open' | Status enum |
| `assigned_to` | `text` | FK → `profiles(id)` | Assigned technician/guard |
| `created_at` | `timestamptz` | Default: now() | Creation timestamp |
| `updated_at` | `timestamptz` | Default: now() | Last update timestamp |

**Relationships**:
- Many-to-one with `residences`
- Many-to-one with `profiles` (reporter)
- Many-to-one with `profiles` (assignee)

### `dbasakan.announcements`
Building-wide announcements and notices.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `bigint` | PK, Identity | Auto-generated ID |
| `residence_id` | `bigint` | FK → `residences(id)`, NOT NULL | Associated residence |
| `title` | `text` | NOT NULL | Announcement title |
| `content` | `text` | NOT NULL | Announcement content |
| `attachment_url` | `text` | | Attachment URL |
| `created_by` | `text` | FK → `profiles(id)`, Default: auth.uid() | Creator (syndic) |
| `created_at` | `timestamptz` | Default: now() | Creation timestamp |

**Relationships**:
- Many-to-one with `residences`
- Many-to-one with `profiles` (creator)

### `dbasakan.polls`
Resident voting polls.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `bigint` | PK, Identity | Auto-generated ID |
| `residence_id` | `bigint` | FK → `residences(id)`, NOT NULL | Associated residence |
| `question` | `text` | NOT NULL | Poll question |
| `is_active` | `boolean` | Default: true | Whether poll is active |
| `created_by` | `text` | FK → `profiles(id)`, Default: auth.uid() | Creator (syndic) |
| `created_at` | `timestamptz` | Default: now() | Creation timestamp |

**Relationships**:
- Many-to-one with `residences`
- Many-to-one with `profiles` (creator)
- One-to-many with `poll_options`
- One-to-many with `poll_votes`

### `dbasakan.poll_options`
Options for poll questions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `bigint` | PK, Identity | Auto-generated ID |
| `poll_id` | `bigint` | FK → `polls(id)`, NOT NULL, ON DELETE CASCADE | Parent poll |
| `option_text` | `text` | NOT NULL | Option text |

**Relationships**:
- Many-to-one with `polls`
- One-to-many with `poll_votes`

### `dbasakan.poll_votes`
Individual votes on poll options.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `bigint` | PK, Identity | Auto-generated ID |
| `poll_id` | `bigint` | FK → `polls(id)`, NOT NULL, ON DELETE CASCADE | Poll being voted on |
| `option_id` | `bigint` | FK → `poll_options(id)`, NOT NULL, ON DELETE CASCADE | Selected option |
| `user_id` | `text` | FK → `profiles(id)`, NOT NULL | Voter |
| `created_at` | `timestamptz` | Default: now() | Vote timestamp |

**Unique Constraint**: `(poll_id, user_id)` - One vote per user per poll

**Relationships**:
- Many-to-one with `polls`
- Many-to-one with `poll_options`
- Many-to-one with `profiles` (voter)

### `dbasakan.access_logs`
QR code-based visitor access logs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `bigint` | PK, Identity | Auto-generated ID |
| `residence_id` | `bigint` | FK → `residences(id)`, NOT NULL | Associated residence |
| `generated_by` | `text` | FK → `profiles(id)`, NOT NULL | Resident who generated QR |
| `visitor_name` | `text` | NOT NULL | Visitor's name |
| `qr_code_data` | `text` | NOT NULL | QR code secret hash |
| `valid_from` | `timestamptz` | NOT NULL | QR validity start |
| `valid_to` | `timestamptz` | NOT NULL | QR validity end |
| `scanned_at` | `timestamptz` | | When QR was scanned (null until used) |
| `scanned_by` | `text` | FK → `profiles(id)` | Guard who scanned |

**Relationships**:
- Many-to-one with `residences`
- Many-to-one with `profiles` (generator)
- Many-to-one with `profiles` (scanner)

### `dbasakan.deliveries`
Package and delivery tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `bigint` | PK, Identity | Auto-generated ID |
| `residence_id` | `bigint` | FK → `residences(id)`, NOT NULL | Associated residence |
| `recipient_id` | `text` | FK → `profiles(id)`, NOT NULL | Recipient resident |
| `logged_by` | `text` | FK → `profiles(id)`, NOT NULL | Guard who logged |
| `description` | `text` | NOT NULL | Delivery description |
| `picked_up_at` | `timestamptz` | | When picked up (null until collected) |
| `created_at` | `timestamptz` | Default: now() | Creation timestamp |

**Relationships**:
- Many-to-one with `residences`
- Many-to-one with `profiles` (recipient)
- Many-to-one with `profiles` (logger)

## NextAuth Tables

These tables are part of the `dbasakan` schema but are managed by NextAuth for authentication.

### `dbasakan.users`
NextAuth user records (separate from `auth.users` and `dbasakan.profiles`).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `text` | PK | NextAuth user ID |
| `name` | `text` | | User's name |
| `email` | `text` | UNIQUE | User's email |
| `email_verified` | `timestamptz` | | Email verification timestamp |
| `image` | `text` | | Profile image URL |
| `created_at` | `timestamptz` | Default: now() | Creation timestamp |
| `updated_at` | `timestamptz` | Default: now() | Last update timestamp |

### `dbasakan.accounts`
OAuth provider accounts linked to users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, Default: gen_random_uuid() | Account ID |
| `user_id` | `text` | FK → `users(id)`, NOT NULL, ON DELETE CASCADE | NextAuth user |
| `type` | `text` | NOT NULL | Account type |
| `provider` | `text` | NOT NULL | OAuth provider (e.g., 'google') |
| `provider_account_id` | `text` | NOT NULL | Provider's user ID |
| `refresh_token` | `text` | | OAuth refresh token |
| `access_token` | `text` | | OAuth access token |
| `expires_at` | `bigint` | | Token expiration |
| `token_type` | `text` | | Token type |
| `scope` | `text` | | OAuth scope |
| `id_token` | `text` | | ID token |
| `session_state` | `text` | | Session state |
| `created_at` | `timestamptz` | Default: now() | Creation timestamp |
| `updated_at` | `timestamptz` | Default: now() | Last update timestamp |

**Unique Constraint**: `(provider, provider_account_id)`

### `dbasakan.sessions`
Active user sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, Default: gen_random_uuid() | Session ID |
| `session_token` | `text` | UNIQUE, NOT NULL | Session token |
| `user_id` | `text` | FK → `users(id)`, NOT NULL, ON DELETE CASCADE | NextAuth user |
| `expires` | `timestamptz` | NOT NULL | Session expiration |
| `created_at` | `timestamptz` | Default: now() | Creation timestamp |
| `updated_at` | `timestamptz` | Default: now() | Last update timestamp |

### `dbasakan.verification_tokens`
Email verification and magic link tokens.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `identifier` | `text` | PK | Email/identifier |
| `token` | `text` | UNIQUE, NOT NULL | Verification token |
| `expires` | `timestamptz` | NOT NULL | Token expiration |

**Composite Primary Key**: `(identifier, token)`

## Row Level Security (RLS)

All tables have RLS enabled. Key policies:

### Service Role Access
- Service role (`service_role`) has full access to NextAuth tables for NextAuth operations
- Service role bypasses RLS for admin operations

### Application Tables
- **Profiles**: Users can view their own profile
- **Payments**: Syndics can view all payments for their residence
- Additional policies should be added as features are implemented

### NextAuth Tables
- Allow insert for `anon` and `authenticated` roles for signup/login flow
- Verification tokens can be created/read by anyone (for email signup)

## Indexes

### NextAuth Indexes
- `accounts_user_id_idx` on `accounts(user_id)`
- `sessions_user_id_idx` on `sessions(user_id)`
- `sessions_session_token_idx` on `sessions(session_token)`

### Recommended Indexes (for performance)
Consider adding indexes on:
- `profiles(residence_id)` - Frequent filtering by residence
- `payments(residence_id, user_id)` - Payment queries
- `fees(residence_id, user_id, status)` - Fee lookups
- `incidents(residence_id, status)` - Incident filtering

## Permissions

```sql
GRANT USAGE ON SCHEMA dbasakan TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA dbasakan TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA dbasakan TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA dbasakan TO anon, authenticated, service_role;
```

## Important Notes

1. **Three User Systems**:
   - `auth.users` (Supabase Auth) - Not used for app users
   - `dbasakan.users` (NextAuth) - Session management
   - `dbasakan.profiles` (App) - Extended user data

2. **Schema Isolation**: All app tables in `dbasakan` schema, not `public`

3. **Migration Safety**: Migration uses `IF NOT EXISTS` - safe to run multiple times

4. **Foreign Keys**: Most tables reference `residences` and `profiles` for data isolation

5. **Cascade Behavior**: 
   - Profile deletion cascades to related records
   - Poll deletion cascades to options and votes
   - Residence deletion sets profile `residence_id` to NULL

## Data Relationships Summary

```
residences (1) ──< (many) profiles
residences (1) ──< (many) fees
residences (1) ──< (many) payments
residences (1) ──< (many) expenses
residences (1) ──< (many) incidents
residences (1) ──< (many) announcements
residences (1) ──< (many) polls
residences (1) ──< (many) access_logs
residences (1) ──< (many) deliveries

profiles (1) ──< (many) fees
profiles (1) ──< (many) payments
profiles (1) ──< (many) expenses (created_by)
profiles (1) ──< (many) incidents (user_id, assigned_to)
profiles (1) ──< (many) poll_votes

polls (1) ──< (many) poll_options
polls (1) ──< (many) poll_votes
poll_options (1) ──< (many) poll_votes

fees (1) ──< (many) payments (optional)
```

---

*This schema documentation should be updated when database changes are made via migrations.*


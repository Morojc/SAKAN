# Supabase Integration - Standard Operating Procedure

## Related Docs
- [Database Schema](../System/database_schema.md)
- [Project Architecture](../System/project_architecture.md)
- [Database Migrations](./database_migrations.md)
- [Supabase Use Rules](../../.cursor/rules/supabase_use.mdc)

## Overview

This guide covers best practices for integrating with Supabase in the SAKAN application, including client creation, data fetching, and security considerations.

## Supabase Client Patterns

### Two Client Types

The application uses two distinct Supabase client patterns:

1. **Authenticated Client** - Uses user's session token, respects RLS
2. **Admin Client** - Uses service_role key, bypasses RLS

## Client Implementations

### Server-Side Authenticated Client

**File**: `utils/supabase/server.ts`

```typescript
import { createClient } from '@supabase/supabase-js'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Database } from '@/types/database.types'

const getSupabaseClient = async () => {
  const session = await auth()

  if (!session?.supabaseAccessToken) {
    redirect('/')
  }
  
  // Creates client with user's JWT token
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${session.supabaseAccessToken}`,
        },
      },
    }
  )
}
```

**Usage**: Server components, server actions that need user context and RLS

**When to Use**:
- Fetching user-specific data
- Operations that should respect RLS policies
- Most common use case in application code

### Server-Side Admin Client

**File**: `utils/supabase/server.ts`

```typescript
function createSupabaseAdminClient() {
  // Uses service_role key - bypasses RLS
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        persistSession: false,
      },
    }
  )
}
```

**Usage**: Webhooks, admin operations, operations that need to bypass RLS

**When to Use**:
- Stripe webhooks
- Background jobs
- Admin operations
- Operations that need to access all data regardless of user

**⚠️ Warning**: Only use in server-side code, never expose to client

### Client-Side Client (Legacy/Alternative)

**File**: `utils/supabase/client.ts`

```typescript
export async function createSupabaseClient() {
  const session = await auth()
  const { supabaseAccessToken } = session

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${supabaseAccessToken}`,
        },
      }
    }
  )
}
```

**Note**: Prefer server components and server actions over client-side Supabase queries.

## Data Fetching Patterns

### Pattern 1: Server Component Direct Query

**Best for**: Initial page load, read-only data

```typescript
// app/app/residents/page.tsx
import { getSupabaseClient } from '@/utils/supabase/server';

async function ResidentsList() {
  const supabase = await getSupabaseClient();
  
  console.log('[ResidentsList] Fetching residents...');
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'resident')
    .order('full_name');
  
  if (error) {
    console.error('[ResidentsList] Error:', error);
    throw error;
  }
  
  return <ResidentsTable residents={data || []} />;
}

export default function ResidentsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ResidentsList />
    </Suspense>
  );
}
```

### Pattern 2: Server Action for Mutations

**Best for**: Form submissions, data mutations

```typescript
// app/app/residents/actions.ts
'use server';

import { getSupabaseClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function addResident(formData: FormData) {
  try {
    console.log('[addResident] Starting...');
    
    const supabase = await getSupabaseClient();
    
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        full_name: formData.get('name'),
        apartment_number: formData.get('apartment'),
        role: 'resident'
      })
      .select()
      .single();
    
    if (error) {
      console.error('[addResident] Error:', error);
      throw new Error('Failed to add resident');
    }
    
    console.log('[addResident] Success:', data);
    
    revalidatePath('/app/residents');
    return { success: true, data };
  } catch (error: any) {
    console.error('[addResident] Error:', error.message);
    return { success: false, error: error.message };
  }
}
```

### Pattern 3: Admin Client for Webhooks

**Best for**: External webhooks, background jobs

```typescript
// app/api/webhook/stripe/route.ts
import { createSupabaseAdminClient } from '@/utils/supabase/server';

const supabaseAdmin = await createSupabaseAdminClient();

export async function POST(request: NextRequest) {
  // ... webhook handling
  
  // Use admin client to bypass RLS
  const { error } = await supabaseAdmin
    .from('stripe_customers')
    .upsert({
      user_id: userId,
      stripe_customer_id: customerId,
      // ...
    });
}
```

## Query Best Practices

### 1. Always Handle Errors

```typescript
const { data, error } = await supabase.from('table').select();

if (error) {
  console.error('[Component] Error:', error);
  // Handle error appropriately
  throw error; // or return error state
}
```

### 2. Use TypeScript Types

```typescript
import { Database } from '@/types/database.types';

const supabase = createClient<Database>(...);

// Now you get autocomplete and type safety
const { data } = await supabase
  .from('profiles')
  .select('*');
// data is typed as Database['dbasakan']['Tables']['profiles']['Row'][]
```

### 3. Specify Columns Explicitly

```typescript
// Good - explicit, only fetches what you need
const { data } = await supabase
  .from('profiles')
  .select('id, full_name, apartment_number, role');

// Avoid - fetches everything
const { data } = await supabase.from('profiles').select('*');
```

### 4. Use Filters Efficiently

```typescript
// Good - uses indexed columns
const { data } = await supabase
  .from('payments')
  .select('*')
  .eq('residence_id', residenceId)
  .eq('status', 'completed')
  .order('paid_at', { ascending: false });

// Add limits for large datasets
.limit(100);
```

### 5. Use Joins for Related Data

```typescript
// Fetch with related data
const { data } = await supabase
  .from('payments')
  .select(`
    *,
    profiles!payments_user_id_fkey(full_name, apartment_number),
    fees!payments_fee_id_fkey(title, amount)
  `);
```

## Schema and Table References

### Always Specify Schema

The application uses `dbasakan` schema, not `public`:

```typescript
// Tables are in dbasakan schema
await supabase.from('profiles').select(); // dbasakan.profiles
await supabase.from('payments').select(); // dbasakan.payments
```

### Table Naming

Reference tables by their exact names from the schema:
- `profiles` (not `users` or `residents`)
- `residences` (not `buildings`)
- `payments`, `fees`, `expenses`, `incidents`, etc.

## Row Level Security (RLS)

### Understanding RLS

RLS is enabled on all `dbasakan` tables. Policies control who can access what data.

### Authenticated Client Behavior
- Respects RLS policies
- User can only access data allowed by policies
- Uses `auth.uid()` to identify current user

### Admin Client Behavior
- Bypasses RLS completely
- Has access to all data
- Only use server-side, never expose to client

### Common RLS Patterns

```sql
-- Users can view own profile
CREATE POLICY "Users can view own profile" ON dbasakan.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Syndics can view all payments for their residence
CREATE POLICY "Syndics view all payments" ON dbasakan.payments
  FOR SELECT
  USING (
    exists (
      select 1 from dbasakan.profiles
      where id = auth.uid() 
      and role = 'syndic' 
      and residence_id = payments.residence_id
    )
  );
```

## Error Handling

### Standard Error Handling Pattern

```typescript
try {
  const { data, error } = await supabase.from('table').select();
  
  if (error) {
    console.error('[Component] Supabase error:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    throw new Error(`Failed to fetch data: ${error.message}`);
  }
  
  return data;
} catch (error: any) {
  console.error('[Component] Unexpected error:', error);
  throw error;
}
```

### Common Error Codes

- `PGRST116`: No rows returned (use `.maybeSingle()` if optional)
- `23503`: Foreign key violation
- `23505`: Unique constraint violation
- `42501`: Insufficient privileges (RLS policy violation)

## Debug Logging

### Required Logging Pattern

Always include debug logs:

```typescript
console.log('[ComponentName] Starting operation...');
console.log('[ComponentName] Parameters:', { param1, param2 });
console.log('[ComponentName] Success:', data);
console.error('[ComponentName] Error:', error);
```

### Log Context

Include enough context to debug:
- Component/function name
- Operation being performed
- Key parameters
- Success/failure status
- Error details

## Environment Variables

Required Supabase environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=          # Public, safe to expose
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Public, has RLS protection
SUPABASE_SECRET_KEY=               # ⚠️ SECRET - server only
SUPABASE_JWT_SECRET=               # ⚠️ SECRET - for token signing
```

**Never expose** `SUPABASE_SECRET_KEY` or `SUPABASE_JWT_SECRET` to the client.

## Type Generation

### Generating Types from Supabase

```bash
# Using Supabase CLI
supabase gen types typescript --project-id your-project-id > types/database.types.ts

# Or manually from Supabase Dashboard
# Settings → API → Copy TypeScript types
```

Update types after schema changes.

## Common Patterns

### Upsert Pattern

```typescript
const { data, error } = await supabase
  .from('stripe_customers')
  .upsert({
    user_id: userId,
    stripe_customer_id: customerId,
    subscription_id: subscriptionId,
    plan_active: true
  }, {
    onConflict: 'user_id' // or specify unique constraint
  })
  .select()
  .single();
```

### Transaction-like Pattern (Multiple Operations)

```typescript
// Note: Supabase doesn't have true transactions in JS client
// For critical operations, consider database functions

const { data: payment, error: paymentError } = await supabase
  .from('payments')
  .insert({...})
  .select()
  .single();

if (paymentError) throw paymentError;

const { error: feeError } = await supabase
  .from('fees')
  .update({ status: 'paid' })
  .eq('id', feeId);

if (feeError) {
  // Rollback payment? Or handle error
  throw feeError;
}
```

### Pagination Pattern

```typescript
const pageSize = 20;
const page = 1;

const { data, error } = await supabase
  .from('payments')
  .select('*', { count: 'exact' })
  .range((page - 1) * pageSize, page * pageSize - 1)
  .order('paid_at', { ascending: false });
```

## Security Checklist

When working with Supabase:

- [ ] Use authenticated client for user operations
- [ ] Use admin client only server-side, never expose to client
- [ ] Never commit `SUPABASE_SECRET_KEY` to version control
- [ ] Always handle errors gracefully
- [ ] Verify RLS policies are working as expected
- [ ] Use parameterized queries (Supabase does this automatically)
- [ ] Validate user input before database operations
- [ ] Use `.single()` or `.maybeSingle()` when expecting one row
- [ ] Include debug logging for troubleshooting
- [ ] Update TypeScript types after schema changes

## Troubleshooting

### "Row Level Security policy violation"
- Check RLS policies for the table
- Verify user has correct role/permissions
- Use admin client if operation should bypass RLS (server-side only)

### "relation does not exist"
- Verify table name is correct
- Check schema is `dbasakan` not `public`
- Ensure migration has been applied

### "JWT expired" or auth errors
- Check `supabaseAccessToken` is being passed
- Verify session is valid
- Check `SUPABASE_JWT_SECRET` is correct

### Type errors after schema change
- Regenerate types from Supabase
- Restart TypeScript server
- Clear `.next` cache and rebuild

---

*Follow this SOP to ensure secure and efficient Supabase integration.*


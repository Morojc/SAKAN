# Server Actions - Standard Operating Procedure

## Related Docs
- [Adding New Pages](./adding_new_pages.md)
- [Supabase Integration](./supabase_integration.md)
- [Project Architecture](../System/project_architecture.md)

## Overview

Server Actions are Next.js's way to handle form submissions and data mutations directly from server components. This guide covers best practices for creating and using server actions in SAKAN.

## What are Server Actions?

Server Actions are async functions that run on the server. They:
- Can be called directly from client components
- Handle form submissions
- Perform database mutations
- Revalidate cached data
- Never expose server code to the client

## Creating Server Actions

### Basic Structure

**File**: `app/app/[feature]/actions.ts`

```typescript
'use server';

import { getSupabaseClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function actionName(params: ActionParams) {
  try {
    // 1. Log start
    console.log('[actionName] Starting...', { params });
    
    // 2. Validate input
    if (!params.requiredField) {
      return { success: false, error: 'Required field missing' };
    }
    
    // 3. Get Supabase client
    const supabase = await getSupabaseClient();
    
    // 4. Perform operation
    const { data, error } = await supabase
      .from('table')
      .insert({...})
      .select()
      .single();
    
    // 5. Handle errors
    if (error) {
      console.error('[actionName] Supabase error:', error);
      return { success: false, error: error.message };
    }
    
    // 6. Log success
    console.log('[actionName] Success:', data);
    
    // 7. Revalidate affected paths
    revalidatePath('/app/feature');
    
    // 8. Return result
    return { success: true, data };
  } catch (error: any) {
    console.error('[actionName] Unexpected error:', error);
    return { success: false, error: error.message };
  }
}
```

### Required Directive

**Always start with `'use server'`**:

```typescript
'use server';
// This marks the file as server-only
```

## Common Patterns

### Pattern 1: Form Data Handler

```typescript
'use server';

import { getSupabaseClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createResident(formData: FormData) {
  try {
    console.log('[createResident] Starting...');
    
    // Extract form data
    const fullName = formData.get('full_name') as string;
    const apartment = formData.get('apartment_number') as string;
    const phone = formData.get('phone_number') as string;
    const residenceId = parseInt(formData.get('residence_id') as string);
    
    // Validate
    if (!fullName || !apartment || !residenceId) {
      return { success: false, error: 'Missing required fields' };
    }
    
    const supabase = await getSupabaseClient();
    
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        full_name: fullName,
        apartment_number: apartment,
        phone_number: phone || null,
        residence_id: residenceId,
        role: 'resident'
      })
      .select()
      .single();
    
    if (error) {
      console.error('[createResident] Error:', error);
      return { success: false, error: error.message };
    }
    
    console.log('[createResident] Success:', data);
    revalidatePath('/app/residents');
    
    return { success: true, data };
  } catch (error: any) {
    console.error('[createResident] Unexpected error:', error);
    return { success: false, error: error.message };
  }
}
```

### Pattern 2: Typed Parameters

```typescript
'use server';

interface CreatePaymentParams {
  residenceId: number;
  userId: string;
  amount: number;
  method: 'cash' | 'bank_transfer' | 'online_card';
  feeId?: number;
}

export async function createPayment(params: CreatePaymentParams) {
  try {
    console.log('[createPayment] Starting...', params);
    
    const { residenceId, userId, amount, method, feeId } = params;
    
    // Validate
    if (!residenceId || !userId || !amount || amount <= 0) {
      return { success: false, error: 'Invalid parameters' };
    }
    
    const supabase = await getSupabaseClient();
    
    const { data, error } = await supabase
      .from('payments')
      .insert({
        residence_id: residenceId,
        user_id: userId,
        amount,
        method,
        fee_id: feeId || null,
        status: method === 'cash' ? 'pending' : 'completed'
      })
      .select()
      .single();
    
    if (error) {
      console.error('[createPayment] Error:', error);
      return { success: false, error: error.message };
    }
    
    console.log('[createPayment] Success:', data);
    revalidatePath('/app/payments');
    revalidatePath('/app'); // Also revalidate dashboard if it shows payments
    
    return { success: true, data };
  } catch (error: any) {
    console.error('[createPayment] Unexpected error:', error);
    return { success: false, error: error.message };
  }
}
```

### Pattern 3: Update Action

```typescript
'use server';

export async function updateResident(
  id: string,
  updates: Partial<{
    full_name: string;
    apartment_number: string;
    phone_number: string;
  }>
) {
  try {
    console.log('[updateResident] Updating:', id, updates);
    
    const supabase = await getSupabaseClient();
    
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('[updateResident] Error:', error);
      return { success: false, error: error.message };
    }
    
    console.log('[updateResident] Success:', data);
    revalidatePath('/app/residents');
    
    return { success: true, data };
  } catch (error: any) {
    console.error('[updateResident] Unexpected error:', error);
    return { success: false, error: error.message };
  }
}
```

### Pattern 4: Delete Action

```typescript
'use server';

export async function deleteResident(id: string) {
  try {
    console.log('[deleteResident] Deleting:', id);
    
    const supabase = await getSupabaseClient();
    
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('[deleteResident] Error:', error);
      return { success: false, error: error.message };
    }
    
    console.log('[deleteResident] Success');
    revalidatePath('/app/residents');
    
    return { success: true };
  } catch (error: any) {
    console.error('[deleteResident] Unexpected error:', error);
    return { success: false, error: error.message };
  }
}
```

## Using Server Actions

### From Forms

```typescript
// Client component
'use client';

import { createResident } from './actions';
import { useFormState } from 'react-dom';

export default function AddResidentForm() {
  const [state, formAction] = useFormState(createResident, null);
  
  return (
    <form action={formAction}>
      <input name="full_name" required />
      <input name="apartment_number" required />
      <button type="submit">Add Resident</button>
      {state?.error && <p className="text-red-500">{state.error}</p>}
    </form>
  );
}
```

### From Button onClick

```typescript
'use client';

import { deleteResident } from './actions';
import { useState } from 'react';

export default function DeleteButton({ residentId }: { residentId: string }) {
  const [loading, setLoading] = useState(false);
  
  async function handleDelete() {
    setLoading(true);
    const result = await deleteResident(residentId);
    setLoading(false);
    
    if (result.success) {
      // Show success toast
    } else {
      // Show error toast
    }
  }
  
  return (
    <button onClick={handleDelete} disabled={loading}>
      Delete
    </button>
  );
}
```

### Direct Call from Server Component

```typescript
// Server component can call server actions directly
import { createResident } from './actions';

export default async function Page() {
  // Can call in server component if needed
  // const result = await createResident(formData);
  
  return <div>...</div>;
}
```

## Return Value Patterns

### Standard Return Pattern

```typescript
// Success
return { success: true, data: result };

// Error
return { success: false, error: 'Error message' };
```

### With Additional Metadata

```typescript
return {
  success: true,
  data: result,
  message: 'Resident created successfully'
};
```

## Revalidation

### revalidatePath

Revalidate specific paths after mutations:

```typescript
import { revalidatePath } from 'next/cache';

// Revalidate a specific page
revalidatePath('/app/residents');

// Revalidate with a layout
revalidatePath('/app/residents', 'layout');

// Revalidate all pages under a path
revalidatePath('/app', 'layout');
```

### revalidateTag (if using fetch with tags)

```typescript
import { revalidateTag } from 'next/cache';

revalidateTag('residents');
```

## Error Handling

### Always Return Consistent Structure

```typescript
// Good - consistent return
return { success: false, error: error.message };

// Bad - inconsistent
throw new Error('Failed');
// or
return null;
// or
return { error: 'Failed' }; // missing success field
```

### Handle Supabase Errors

```typescript
if (error) {
  console.error('[actionName] Supabase error:', {
    message: error.message,
    code: error.code,
    details: error.details
  });
  
  // Return user-friendly error
  return { 
    success: false, 
    error: error.message || 'Operation failed' 
  };
}
```

## Validation

### Input Validation

Always validate inputs:

```typescript
// Validate required fields
if (!fullName || !apartment) {
  return { success: false, error: 'Missing required fields' };
}

// Validate types
const amount = parseFloat(formData.get('amount') as string);
if (isNaN(amount) || amount <= 0) {
  return { success: false, error: 'Invalid amount' };
}

// Validate enums
const validMethods = ['cash', 'bank_transfer', 'online_card'];
if (!validMethods.includes(method)) {
  return { success: false, error: 'Invalid payment method' };
}
```

## Best Practices Checklist

- [ ] File starts with `'use server'` directive
- [ ] Function is async
- [ ] Includes debug logging at start, success, and error
- [ ] Validates input parameters
- [ ] Uses `getSupabaseClient()` for authenticated operations
- [ ] Handles Supabase errors gracefully
- [ ] Returns consistent `{ success, data?, error? }` structure
- [ ] Calls `revalidatePath()` after mutations
- [ ] Uses TypeScript types for parameters
- [ ] Never exposes sensitive logic to client
- [ ] Includes try/catch for error handling
- [ ] Logs include component/function name prefix

## Common Mistakes to Avoid

1. **Forgetting 'use server'** - Action won't work without it
2. **Not revalidating** - UI won't update after mutation
3. **Inconsistent return values** - Makes error handling difficult
4. **No input validation** - Security and data integrity issues
5. **Not handling errors** - Poor user experience
6. **Missing debug logs** - Hard to troubleshoot
7. **Using admin client unnecessarily** - Should use authenticated client when possible
8. **Exposing sensitive data in return** - Be careful what you return

## Advanced Patterns

### Multiple Operations

```typescript
export async function createPaymentWithFeeUpdate(params: PaymentParams) {
  const supabase = await getSupabaseClient();
  
  // Create payment
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({...})
    .select()
    .single();
  
  if (paymentError) {
    return { success: false, error: paymentError.message };
  }
  
  // Update fee status
  if (params.feeId) {
    const { error: feeError } = await supabase
      .from('fees')
      .update({ status: 'paid' })
      .eq('id', params.feeId);
    
    if (feeError) {
      console.error('[createPaymentWithFeeUpdate] Fee update error:', feeError);
      // Payment created but fee not updated - consider rollback or notification
    }
  }
  
  revalidatePath('/app/payments');
  return { success: true, data: payment };
}
```

### Conditional Logic

```typescript
export async function updatePaymentStatus(
  paymentId: number,
  status: 'pending' | 'completed' | 'rejected',
  verifiedBy?: string
) {
  const supabase = await getSupabaseClient();
  
  const updateData: any = { status };
  
  if (status === 'completed' && verifiedBy) {
    updateData.verified_by = verifiedBy;
  }
  
  const { data, error } = await supabase
    .from('payments')
    .update(updateData)
    .eq('id', paymentId)
    .select()
    .single();
  
  // ... error handling and revalidation
}
```

---

*Follow this SOP to create maintainable and reliable server actions.*


# Adding New Pages - Standard Operating Procedure

## Related Docs
- [Project Architecture](../System/project_architecture.md)
- [Frontend Rules](../../.cursor/rules/frontend_mdc.mdc)
- [Supabase Integration](./supabase_integration.md)

## Overview

This guide covers how to add new pages to the SAKAN application following established patterns and best practices.

## Page Location

**Authenticated Pages**: `app/app/[feature]/page.tsx`  
**Public Pages**: `app/[feature]/page.tsx`  
**API Routes**: `app/api/[route]/route.ts`

## Adding an Authenticated Page

### Step 1: Create Page File

Create a new directory and `page.tsx` file:

```bash
# Example: Adding a residents management page
app/app/residents/page.tsx
```

### Step 2: Page Structure

Follow this structure for server components:

```typescript
// app/app/residents/page.tsx
import { getSupabaseClient } from '@/utils/supabase/server';
import { Suspense } from 'react';
import ResidentsTable from '@/components/app/ResidentsTable';
import AddResidentDialog from '@/components/app/AddResidentDialog';

// Server component for data fetching
async function ResidentsList() {
  const supabase = await getSupabaseClient();
  
  // Debug logging
  console.log('[ResidentsPage] Fetching residents...');
  
  const { data: residents, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'resident')
    .order('full_name');
  
  if (error) {
    console.error('[ResidentsPage] Error fetching residents:', error);
    throw error;
  }
  
  console.log('[ResidentsPage] Loaded', residents?.length || 0, 'residents');
  
  return <ResidentsTable residents={residents || []} />;
}

// Main page component
export default function ResidentsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Residents</h1>
        <AddResidentDialog />
      </div>
      
      <Suspense fallback={
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-background rounded-lg p-4 shadow animate-pulse">
              <div className="h-6 bg-muted rounded w-1/4 mb-2"></div>
              <div className="h-4 bg-muted rounded w-3/4"></div>
            </div>
          ))}
        </div>
      }>
        <ResidentsList />
      </Suspense>
    </div>
  );
}
```

### Step 3: Update Navigation

Add the new page to navigation components:

#### Update Sidebar (`components/app/Sidebar.tsx`)

```typescript
import { Users } from "lucide-react" // Add icon import

// Add to navigation links
<Link
  href="/app/residents"
  className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 hover:text-white"
>
  <Users className="inline-block mr-2" size={20} />
  Residents
</Link>
```

#### Update Header if needed (`components/app/Header.tsx`)

Add any header-specific navigation or actions.

### Step 4: Create Components

Create feature-specific components in `components/app/[feature]/`:

```
components/app/residents/
  ├── ResidentsTable.tsx
  ├── AddResidentDialog.tsx
  ├── EditResidentDialog.tsx
  └── loading.tsx (optional)
```

### Step 5: Create Server Actions (if needed)

Create `app/app/[feature]/actions.ts` for data mutations:

```typescript
// app/app/residents/actions.ts
'use server';

import { getSupabaseClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function addResident(data: {
  full_name: string;
  apartment_number: string;
  phone_number?: string;
  residence_id: number;
}) {
  try {
    console.log('[addResident] Adding resident:', data);
    
    const supabase = await getSupabaseClient();
    
    const { data: resident, error } = await supabase
      .from('profiles')
      .insert({
        ...data,
        role: 'resident'
      })
      .select()
      .single();
    
    if (error) {
      console.error('[addResident] Error:', error);
      throw new Error('Failed to add resident');
    }
    
    console.log('[addResident] Success:', resident);
    
    // Revalidate the residents page
    revalidatePath('/app/residents');
    
    return { success: true, data: resident };
  } catch (error: any) {
    console.error('[addResident] Error:', error.message);
    return { success: false, error: error.message };
  }
}
```

## Adding a Public Page

For public pages (landing, about, etc.):

```typescript
// app/about/page.tsx
export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold mb-6">About SAKAN</h1>
      <p className="text-lg text-muted-foreground">
        Content here...
      </p>
    </div>
  );
}
```

## Page Requirements Checklist

### Must Have
- [ ] Uses `'use client'` directive ONLY if component uses hooks (useState, useEffect, etc.)
- [ ] Server components for data fetching (default)
- [ ] Debug logging with `console.log('[PageName] ...')`
- [ ] Error handling with try/catch
- [ ] Suspense boundaries for async data
- [ ] Responsive design with Tailwind
- [ ] Uses shadcn/ui components (don't recreate)
- [ ] Uses Tailwind CSS variables (bg-primary, text-foreground, etc.)
- [ ] No direct fetch() calls - use Supabase client or server actions
- [ ] Proper TypeScript types

### Should Have
- [ ] Loading states (Suspense fallback)
- [ ] Empty states
- [ ] Error states with user-friendly messages
- [ ] Proper page metadata (if public)
- [ ] Accessibility considerations (ARIA labels, keyboard navigation)

### Styling Guidelines
- Use Tailwind CSS utility classes
- Use CSS variables from `globals.css`:
  - `bg-primary`, `text-primary-foreground`
  - `bg-background`, `text-foreground`
  - `bg-muted`, `text-muted-foreground`
  - `border`, `border-hover`
- Use shadcn/ui components: Button, Card, Dialog, Table, etc.
- Use Lucide React for icons
- Responsive: Mobile-first, use `md:`, `lg:` breakpoints

## Component Patterns

### Server Component with Data Fetching

```typescript
// Server component - can directly fetch data
async function DataList() {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.from('table').select();
  
  if (error) throw error;
  return <Table data={data} />;
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <DataList />
    </Suspense>
  );
}
```

### Client Component with Server Actions

```typescript
'use client';

import { useState } from 'react';
import { addItem } from './actions';
import { Button } from '@/components/ui/button';

export default function ClientForm() {
  const [loading, setLoading] = useState(false);
  
  async function handleSubmit(formData: FormData) {
    setLoading(true);
    console.log('[ClientForm] Submitting...');
    
    const result = await addItem(formData);
    
    if (result.success) {
      console.log('[ClientForm] Success');
    } else {
      console.error('[ClientForm] Error:', result.error);
    }
    
    setLoading(false);
  }
  
  return (
    <form action={handleSubmit}>
      {/* form fields */}
      <Button type="submit" disabled={loading}>
        Submit
      </Button>
    </form>
  );
}
```

## Route Protection

### Middleware Protection

The `middleware.ts` file protects `/app/*` routes:

```typescript
// middleware.ts
export const config = {
  matcher: ["/app"],
};
```

Unauthenticated users are redirected to `/api/auth/signin`.

### Manual Protection in Server Components

```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function ProtectedPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/api/auth/signin');
  }
  
  // Check role if needed
  // const userRole = session.user.role;
  // if (userRole !== 'syndic') {
  //   redirect('/app');
  // }
  
  return <div>Protected content</div>;
}
```

## Common Patterns

### List Page with Search/Filter

```typescript
// Server component for data
async function FilteredList({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = await getSupabaseClient();
  let query = supabase.from('table').select();
  
  if (searchParams.q) {
    query = query.ilike('name', `%${searchParams.q}%`);
  }
  
  const { data } = await query;
  return <Table data={data} />;
}

export default function Page({ searchParams }: { searchParams: { q?: string } }) {
  return (
    <div>
      <SearchInput defaultValue={searchParams.q} />
      <Suspense fallback={<Loading />}>
        <FilteredList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
```

### Form with Server Action

```typescript
// actions.ts
'use server';
export async function createItem(formData: FormData) {
  const supabase = await getSupabaseClient();
  // ... insert logic
  revalidatePath('/app/items');
}

// page.tsx
import { createItem } from './actions';

export default function Page() {
  return (
    <form action={createItem}>
      <input name="title" />
      <button type="submit">Create</button>
    </form>
  );
}
```

## File Organization

```
app/app/
  [feature]/
    page.tsx           # Main page component
    actions.ts         # Server actions (optional)
    loading.tsx        # Loading UI (optional)
    error.tsx          # Error UI (optional)
    layout.tsx         # Feature-specific layout (optional)

components/app/
  [feature]/
    [Feature]Table.tsx
    Add[Feature]Dialog.tsx
    Edit[Feature]Dialog.tsx
    [Feature]Card.tsx
    loading.tsx
```

## Testing Checklist

Before considering a page complete:

- [ ] Page loads without errors
- [ ] Data fetches correctly
- [ ] Loading states display properly
- [ ] Error states handle gracefully
- [ ] Forms submit and update data
- [ ] Navigation links work
- [ ] Responsive on mobile/tablet/desktop
- [ ] Debug logs are present and helpful
- [ ] No console errors
- [ ] TypeScript compiles without errors
- [ ] Follows established patterns from existing pages

## Common Mistakes to Avoid

1. **Don't use 'use client' unnecessarily** - Only for components with hooks
2. **Don't fetch data in client components** - Use server components or server actions
3. **Don't recreate shadcn components** - Use `npx shadcn@latest add [component]`
4. **Don't use hardcoded colors** - Use Tailwind CSS variables
5. **Don't forget error handling** - Always handle Supabase errors
6. **Don't skip debug logging** - Helps with troubleshooting
7. **Don't forget to revalidate** - Use `revalidatePath()` after mutations
8. **Don't use fetch() directly** - Always use Supabase client

---

*Follow this SOP to ensure consistency and maintainability when adding new pages.*


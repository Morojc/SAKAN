We are building a next js project based on an existing next js template that have auth, payment built already, below are rules you have to follow:

<frontend rules>
1. MUST Use 'use client' directive for client-side components; In Next.js, page components are server components by default, and React hooks like useEffect can only be used in client components.
2. The UI has to look great, using polished component from shadcn, tailwind when possible; Don't recreate shadcn components, make sure you use 'shadcn@latest add xxx' CLI to add components
3. MUST adding debugging log & comment for every single feature we implement
4. Make sure to concatenate strings correctly using backslash
7. Use stock photos from picsum.photos where appropriate, only valid URLs you know exist
8. Don't update shadcn components unless otherwise specified
9. Configure next.config.js image remotePatterns to enable stock photos from picsum.photos
11. MUST implement the navigation elements items in their rightful place i.e. Left sidebar, Top header
12. Accurately implement necessary grid layouts
13. Follow proper import practices:
   - Use @/ path aliases
   - Keep component imports organized
   - Update current src/app/page.tsx with new comprehensive code
   - Don't forget root route (page.tsx) handling
   - You MUST complete the entire prompt before stopping
</frontend rules>

<styling_requirements>
- You ALWAYS tries to use the shadcn/ui library.
- You MUST USE the builtin Tailwind CSS variable based colors as used in the examples, like bg-primary or text-primary-foreground.
- You DOES NOT use indigo or blue colors unless specified in the prompt.
- You MUST generate responsive designs.
- The React Code Block is rendered on top of a white background. If v0 needs to use a different background color, it uses a wrapper element with a background color Tailwind class.
</styling_requirements>

<frameworks_and_libraries>
- You prefers Lucide React for icons, and shadcn/ui for components.
- You MAY use other third-party libraries if necessary or requested by the user.
- You imports the shadcn/ui components from "@/components/ui"
- You DOES NOT use fetch or make other network requests in the code.
- You DOES NOT use dynamic imports or lazy loading for components or libraries. Ex: const Confetti = dynamic(...) is NOT allowed. Use import Confetti from 'react-confetti' instead.
- Prefer using native Web APIs and browser features when possible. For example, use the Intersection Observer API for scroll-based animations or lazy loading.
</frameworks_and_libraries>

# Residents List & Fee Management — Implementation Guide

This guide details the step-by-step implementation for the **Residents List & Fee Management** module in the MyResidency Web Admin Dashboard (Syndic).  
It covers:  
- Residents table (view/search/filter/add/edit/delete)  
- Fee management (view outstanding fees, generate monthly fees, mark as paid)  
- UI/UX requirements  
- Data fetching with Supabase (with auth)  
- Debug logging for all key actions

---

## 1. Residents List Page Setup

**Location:**  
`app/app/residents/page.tsx`  
**Components:**  
- `ResidentsTable` (`components/app/ResidentsTable.tsx`)
- `AddResidentDialog` (`components/app/AddResidentDialog.tsx`)
- `EditResidentDialog` (`components/app/EditResidentDialog.tsx`)
- `DeleteResidentDialog` (`components/app/DeleteResidentDialog.tsx`)

### Steps

1. **Page Skeleton**
   - Render a page with a heading ("Residents"), an "Add Resident" button, and the residents table.
   - Use shadcn/ui `Button`, `Input`, and `Table` components.
   - Wrap content in a responsive container (`max-w-7xl mx-auto px-4 py-8`).

2. **Residents Table**
   - Use shadcn/ui `Table` for listing residents.
   - Columns: Name, Apartment, Email, Phone, Status (Badge), Outstanding Fees (Badge), Actions (Edit/Delete).
   - Add search input (by name/apartment) above the table.
   - Add filter dropdown for status (Active/Inactive).
   - Add pagination (shadcn/ui Table pagination or custom).

3. **Add/Edit/Delete Resident**
   - "Add Resident" button opens `AddResidentDialog` (shadcn/ui `Dialog`).
   - Each row has Edit (pencil icon) and Delete (trash icon) actions.
   - Edit opens `EditResidentDialog` pre-filled with resident data.
   - Delete opens confirmation dialog.

4. **Outstanding Fees**
   - For each resident, show total outstanding fees (sum of unpaid/overdue fees from `fee` table).
   - Display as a colored badge (e.g., red for overdue, yellow for unpaid, green for none).

5. **Debug Logging**
   - On every data fetch, log:  
     `console.log('[Residents] Fetching residents list', { search, filter });`
   - On add/edit/delete, log action and payload:  
     `console.log('[Residents] Adding resident', formData);`  
     `console.log('[Residents] Editing resident', { id, updates });`  
     `console.log('[Residents] Deleting resident', id);`
   - On error, log:  
     `console.error('[Residents] Error:', error);`

---

## 2. Data Fetching & State Management

### Residents List

- Use Supabase browser client (`utils/supabase/client.ts`) to fetch residents.
- Query `user` table where `role = 'resident'`.
- For outstanding fees, join with `fee` table, sum where `status = 'unpaid' or 'overdue'`.

**Example:**
```typescript
import { createSupabaseClient } from '@/utils/supabase/client';

export async function fetchResidents(search: string, status: string) {
  const supabase = await createSupabaseClient();
  let query = supabase
    .from('user')
    .select('id, name, email, phone, apartment, status')
    .eq('role', 'resident');

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }
  if (status) {
    query = query.eq('status', status);
  }

  // Fetch residents
  const { data: residents, error } = await query;
  console.log('[Residents] Fetching residents list', { search, status });
  if (error) {
    console.error('[Residents] Error:', error);
    return [];
  }

  // Fetch outstanding fees for each resident
  const supabase2 = await createSupabaseClient();
  const { data: fees, error: feeError } = await supabase2
    .from('fee')
    .select('user_id, amount, status')
    .in('status', ['unpaid', 'overdue']);
  if (feeError) {
    console.error('[Residents] Fee fetch error:', feeError);
  }

  // Map fees to residents
  const feeMap = new Map();
  fees?.forEach(fee => {
    feeMap.set(fee.user_id, (feeMap.get(fee.user_id) || 0) + fee.amount);
  });

  return residents.map(r => ({
    ...r,
    outstandingFees: feeMap.get(r.id) || 0,
  }));
}
```

### Add/Edit/Delete Resident

- Use Supabase `insert`, `update`, `delete` on `user` table.
- On add, require: name, email, apartment, phone, status.
- On edit, allow updating all fields except id.
- On delete, remove resident and all their fees/payments (optional: confirm with user).

**Debug log every mutation.**

---

## 3. Fee Management (Monthly Fee Generation)

**Location:**  
- "Generate Fees" button in Payments module, but also allow per-resident fee creation in Residents table.

### Steps

1. **Outstanding Fees Column**
   - For each resident, show badge with total outstanding amount.
   - If >0, badge is `bg-destructive text-destructive-foreground`.
   - If 0, badge is `bg-success text-success-foreground`.

2. **Per-Resident Fee Creation**
   - In Actions menu, add "Add Fee" (plus icon).
   - Opens dialog: amount, due date, status (default: unpaid).
   - On submit, insert into `fee` table with resident's user_id.

3. **Monthly Fee Generation (Bulk)**
   - In Payments module, "Generate Fees" button opens dialog:
     - Select month, default amount per apartment, due date.
     - Optionally allow custom amount per resident.
   - On confirm, insert fee records for all residents.
   - Log:  
     `console.log('[Fees] Generating monthly fees', { month, amount, dueDate });`
   - On error, log:  
     `console.error('[Fees] Generation error:', error);`

4. **Mark Fee as Paid**
   - When payment is recorded, update corresponding fee status to 'paid'.
   - Log:  
     `console.log('[Fees] Marking fee as paid', { feeId, paymentId });`

---

## 4. UI/UX & Styling

- Use shadcn/ui for all dialogs, tables, buttons, inputs, badges.
- Use Lucide icons for actions (edit, delete, add, fee).
- Responsive:  
  - Table scrolls horizontally on mobile.
  - Dialogs are full-screen on mobile.
- Use Tailwind variable-based colors:  
  - `bg-primary`, `text-primary-foreground`, `bg-background`, `bg-destructive`, etc.
- Table header: sticky on scroll.
- "Add Resident" button: `variant="default"`, `className="ml-auto"`.

---

## 5. Example Residents Table Row

| Name         | Apartment | Email              | Phone      | Status   | Outstanding Fees | Actions         |
|--------------|-----------|--------------------|------------|----------|------------------|-----------------|
| John Smith   | A-101     | john@email.com     | 555-1234   | Active   | $200 (red badge) | Edit | Delete | Add Fee |
| Jane Doe     | B-202     | jane@email.com     | 555-5678   | Inactive | $0 (green badge) | Edit | Delete | Add Fee |

---

## 6. Error Handling & Debug Logging

- All fetch/mutation actions must log both success and error states.
- Example:
  ```typescript
  try {
    // ...fetch or mutate
    console.log('[Residents] Successfully added resident', newResident);
  } catch (error) {
    console.error('[Residents] Error adding resident:', error);
  }
  ```
- For UI errors, show shadcn/ui `Alert` with error message.

---

## 7. Constraints & Guidelines

- **Do not use fetch or direct network requests; always use Supabase client.**
- **All UI must use shadcn/ui and Tailwind variable-based colors.**
- **No placeholder components for table, dialogs, or badges.**
- **All actions must be logged for debugging.**
- **All features must be responsive.**
- **No dynamic imports.**
- **No code for authentication or payment logic—reuse existing utilities.**

---

## 8. File Structure

```
app/
  app/
    residents/
      page.tsx
components/
  app/
    ResidentsTable.tsx
    AddResidentDialog.tsx
    EditResidentDialog.tsx
    DeleteResidentDialog.tsx
    AddFeeDialog.tsx
utils/
  supabase/
    client.ts
```

---

## 9. Example ResidentsTable Props

```typescript
interface ResidentsTableProps {
  residents: Array<{
    id: string;
    name: string;
    apartment: string;
    email: string;
    phone: string;
    status: 'active' | 'inactive';
    outstandingFees: number;
  }>;
  onEdit: (residentId: string) => void;
  onDelete: (residentId: string) => void;
  onAddFee: (residentId: string) => void;
}
```

---

## 10. Summary

- Residents page: table, search, filter, add/edit/delete, outstanding fees.
- Fee management: per-resident and bulk fee creation, mark as paid.
- All UI: shadcn/ui, Tailwind variable colors, Lucide icons, responsive.
- All data: Supabase client, with debug logs for every action.
- All errors: log and show in UI.

---

**Follow this guide to implement a beautiful, robust, and debuggable Residents List & Fee Management module.**  
If you need a breakdown for a specific dialog or table, ask for a sub-task!
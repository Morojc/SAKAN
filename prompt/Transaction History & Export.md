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

# Transaction History & Export — Implementation Guide

## Task
Implement a **Transaction History** page for Syndic (Admin) users to view, search, filter, and export all payment and expense transactions.  
This includes a beautiful, responsive table UI, advanced filtering, and CSV export.  
**All UI must use shadcn/ui and Tailwind variable-based colors.**

---

## Implementation Steps

### 1. **Create the Transaction History Page**

- **Location:**  
  `app/app/transactions/page.tsx`

- **Purpose:**  
  Display a unified, filterable table of all payments and expenses.

- **UI/UX:**
  - Use shadcn/ui `Tabs` to switch between "All", "Payments", and "Expenses".
  - Use shadcn/ui `Table` for listing transactions.
  - Add a responsive filter/search bar above the table.
  - Add a shadcn/ui `Button` for "Export CSV" (top right).
  - Use Lucide icons for transaction type, method, and status.
  - Table columns:  
    - Date  
    - Type (Payment/Expense)  
    - Resident/Payee  
    - Description/Category  
    - Amount  
    - Method (Cash/Online/Bank)  
    - Status  
    - Actions (View details)
  - Responsive:  
    - On mobile, stack filters and make table horizontally scrollable.

- **Styling:**
  - Use `bg-background`, `text-foreground`, `bg-primary`, `text-primary-foreground` for highlights.
  - Table header: `bg-muted`, `text-muted-foreground`.
  - Use badges for status/method.

---

### 2. **Fetch and Combine Data from Supabase**

- **Data Sources:**
  - `payment` table (for payments)
  - `expense` table (for expenses)

- **Implementation:**
  - Use the browser Supabase client (`utils/supabase/client.ts`) to fetch:
    - All payments (join with `user` for resident name)
    - All expenses (join with `user` for payee name)
  - Combine into a single array with a `type` field (`'payment'` or `'expense'`).

- **Example:**
  ```typescript
  import { createSupabaseClient } from '@/utils/supabase/client';

  export async function getTransactions() {
    const supabase = await createSupabaseClient();

    // Fetch payments
    const { data: payments, error: paymentsError } = await supabase
      .from('payment')
      .select('id, amount, method, status, paid_at, user_id, fee_id, user(name, apartment)')
      .order('paid_at', { ascending: false });

    // Fetch expenses
    const { data: expenses, error: expensesError } = await supabase
      .from('expense')
      .select('id, description, category, amount, paid_from, paid_at, user_id, user(name)')
      .order('paid_at', { ascending: false });

    if (paymentsError || expensesError) {
      console.log('[TransactionHistory] Error fetching data', { paymentsError, expensesError });
      return [];
    }

    // Normalize and combine
    const transactions = [
      ...(payments ?? []).map(p => ({
        id: p.id,
        type: 'payment',
        date: p.paid_at,
        name: p.user?.name,
        apartment: p.user?.apartment,
        description: p.fee_id ? 'Monthly Fee' : 'Payment',
        category: null,
        amount: p.amount,
        method: p.method,
        status: p.status,
      })),
      ...(expenses ?? []).map(e => ({
        id: e.id,
        type: 'expense',
        date: e.paid_at,
        name: e.user?.name,
        apartment: null,
        description: e.description,
        category: e.category,
        amount: e.amount,
        method: e.paid_from,
        status: 'completed',
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    console.log('[TransactionHistory] Loaded', { count: transactions.length });
    return transactions;
  }
  ```

- **Debug Logging:**
  - Log fetch start/end, errors, and result counts.
  - Example:  
    `console.log('[TransactionHistory] Fetched payments:', payments?.length);`

---

### 3. **Implement Filtering, Search, and Tabs**

- **State:**
  - `activeTab`: `'all' | 'payment' | 'expense'`
  - `search`: string
  - `filters`: { method?: string, status?: string, dateRange?: [Date, Date] }

- **UI:**
  - shadcn/ui `Input` for search (resident/payee name, description).
  - shadcn/ui `Select` for method and status.
  - shadcn/ui `DatePicker` for date range.
  - All filters update the displayed transactions in real time.

- **Example Filtering Logic:**
  ```typescript
  const filtered = transactions.filter(tx => {
    if (activeTab !== 'all' && tx.type !== activeTab) return false;
    if (search && !tx.name?.toLowerCase().includes(search.toLowerCase()) && !tx.description?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filters.method && tx.method !== filters.method) return false;
    if (filters.status && tx.status !== filters.status) return false;
    if (filters.dateRange && (new Date(tx.date) < filters.dateRange[0] || new Date(tx.date) > filters.dateRange[1])) return false;
    return true;
  });
  ```

- **Debug Logging:**
  - Log filter changes and resulting counts.
  - Example:  
    `console.log('[TransactionHistory] Filtered', { activeTab, search, filters, count: filtered.length });`

---

### 4. **Table UI & Row Actions**

- **Table:**
  - Use shadcn/ui `Table` for rendering.
  - Use Lucide icons for type (e.g., `CreditCard` for payment, `Receipt` for expense).
  - Use shadcn/ui `Badge` for method/status.
  - Add a "View details" action (shadcn/ui `Button` or icon) per row.

- **Details Modal:**
  - On "View details", open a shadcn/ui `Dialog` showing all transaction fields.
  - For payments, show resident, method, status, and link to receipt if available.
  - For expenses, show description, category, attachment if available.

- **Debug Logging:**
  - Log when a row is clicked for details.
  - Example:  
    `console.log('[TransactionHistory] View details', { id: tx.id, type: tx.type });`

---

### 5. **CSV Export Functionality**

- **UI:**
  - shadcn/ui `Button` labeled "Export CSV" (top right).
  - Disabled if no transactions in current filter.

- **Implementation:**
  - On click, generate a CSV from the currently filtered transactions.
  - Use a utility function (e.g., `utils/csv.ts`) to convert array to CSV string.
  - Trigger download using a Blob and anchor element.

- **Example Utility:**
  ```typescript
  export function exportTransactionsToCSV(transactions: any[]) {
    const headers = ['Date', 'Type', 'Name', 'Apartment', 'Description', 'Category', 'Amount', 'Method', 'Status'];
    const rows = transactions.map(tx => [
      tx.date,
      tx.type,
      tx.name,
      tx.apartment ?? '',
      tx.description,
      tx.category ?? '',
      tx.amount,
      tx.method,
      tx.status,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    console.log('[TransactionHistory] Exported CSV', { count: transactions.length });
  }
  ```

- **Debug Logging:**
  - Log export start/end and file name.
  - Example:  
    `console.log('[TransactionHistory] Export CSV clicked', { count: filtered.length });`

---

### 6. **Pagination (If Needed)**

- **UI:**
  - Use shadcn/ui `Pagination` component below the table if transactions > 20.
  - Show current page, total pages, and navigation.

- **State:**
  - `page`: number
  - `pageSize`: number (default 20)

- **Debug Logging:**
  - Log page changes.
  - Example:  
    `console.log('[TransactionHistory] Page changed', { page });`

---

### 7. **Accessibility & Responsiveness**

- **Accessibility:**
  - All buttons and inputs have `aria-label`.
  - Table rows are keyboard navigable.

- **Responsiveness:**
  - On mobile, filters stack vertically.
  - Table is horizontally scrollable (`overflow-x-auto`).
  - Use Tailwind breakpoints for grid and padding.

---

### 8. **File & Component Structure**

- **Page:**  
  `app/app/transactions/page.tsx` (main page, fetches data, manages state)
- **Components:**  
  - `components/app/TransactionTable.tsx` (table UI, filters, pagination)
  - `components/app/TransactionDetailsDialog.tsx` (details modal)
  - `utils/csv.ts` (CSV export utility)

---

## Constraints & Guidelines

- **Do not use fetch or direct network requests; always use Supabase client.**
- **All UI must use shadcn/ui and Tailwind variable-based colors.**
- **No placeholder components for table, filters, or export.**
- **All user actions (filter, export, view details) must be logged with `console.log` for debugging.**
- **No dynamic imports or lazy loading.**
- **All features must be responsive and accessible.**

---

## Example Debug Log Output

```
[TransactionHistory] Fetched payments: 42
[TransactionHistory] Fetched expenses: 17
[TransactionHistory] Loaded { count: 59 }
[TransactionHistory] Filtered { activeTab: 'payment', search: 'smith', filters: { method: 'cash' }, count: 3 }
[TransactionHistory] View details { id: 123, type: 'payment' }
[TransactionHistory] Export CSV clicked { count: 12 }
[TransactionHistory] Exported CSV { count: 12 }
[TransactionHistory] Page changed { page: 2 }
```

---

## Deliverables

- `app/app/transactions/page.tsx` with full UI and logic as above.
- `components/app/TransactionTable.tsx` and `TransactionDetailsDialog.tsx` as needed.
- `utils/csv.ts` for export.
- All debug logs as specified.

---

**This guide leaves no ambiguity for developers.  
All UI, data, and debug requirements are explicit.  
If you need a code scaffold or more detail for any step, ask!**
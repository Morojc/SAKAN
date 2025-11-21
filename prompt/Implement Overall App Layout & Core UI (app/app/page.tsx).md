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

# MyResidency — Implement Overall App Layout & Core UI (`app/app/page.tsx`)

## Task
Build the foundational dashboard layout for the Syndic (Admin) web app, including sidebar navigation, responsive design, and a beautiful, modern UI using shadcn/ui and Tailwind variable-based colors.  
**This is the entry point for all authenticated dashboard features.**

---

## Implementation Guide

### 1. Sidebar Navigation

**Goal:**  
Provide persistent, intuitive navigation to all main modules.

**Steps:**

1. **Create Sidebar Component (`components/app/Sidebar.tsx`):**
   - Use shadcn/ui’s `Sheet` for mobile and a fixed sidebar for desktop.
   - List all main sections as navigation items:
     - Dashboard (home)
     - Residents
     - Payments
     - Expenses
     - Incidents
     - Announcements
     - Polls
     - Access Control
     - Deliveries
     - Settings
     - Audit Log
   - Use Lucide React icons for each item.
   - Highlight the current section (active state).
   - Add responsive collapse/expand for mobile (Sheet).
   - Use Tailwind variable-based colors:  
     - Sidebar bg: `bg-background`  
     - Active item: `bg-primary text-primary-foreground`  
     - Inactive: `text-muted-foreground`  
   - Add debug logs for navigation:
     ```js
     console.debug('[Sidebar] Navigation item clicked:', { section });
     ```

2. **Integrate Sidebar in `app/app/layout.tsx`:**
   - Place sidebar on the left, main content on the right.
   - Use a responsive flex layout (`flex`, `min-h-screen`).
   - On mobile, sidebar should be hidden by default and toggled via a button in the header.

---

### 2. Update Header for Dashboard Context

**Goal:**  
Ensure the header matches the dashboard’s look and provides quick access to profile and notifications.

**Steps:**

1. **Update `components/app/Header.tsx`:**
   - Set header background to `bg-primary`, text to `text-primary-foreground`.
   - Add Syndic avatar/profile menu on the right (use shadcn/ui `Avatar`, `DropdownMenu`).
   - Add notification bell icon (Lucide) with badge for unread count.
   - On mobile, add a button to open the sidebar (`Sheet`).
   - Add debug logs for profile and notification actions:
     ```js
     console.debug('[Header] Profile menu opened');
     console.debug('[Header] Notification bell clicked');
     ```

2. **Ensure header is imported in `app/app/layout.tsx` (already present).**

---

### 3. Main Content Area

**Goal:**  
Provide a clean, padded, responsive area for all dashboard modules.

**Steps:**

1. **In `app/app/layout.tsx`:**
   - Wrap main content in a div with:
     - `flex-1`
     - `p-4 md:p-8`
     - `bg-background`
     - `overflow-y-auto`
   - Ensure content area is scrollable if sidebar/header are fixed.

2. **Add debug log on page load:**
   ```js
   console.debug('[AppLayout] Dashboard layout rendered');
   ```

---

### 4. Dashboard Home Content (`app/app/page.tsx`)

**Goal:**  
Show a beautiful overview with stat cards for key metrics.

**Steps:**

1. **Create Overview Cards Component (`components/app/OverviewCards.tsx`):**
   - Use shadcn/ui `Card` for each stat:
     - Total Residents
     - Cash on Hand
     - Bank Balance
     - Outstanding Fees
     - Open Incidents
     - Recent Announcements
   - Use Lucide icons for each card.
   - Responsive grid:  
     - `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`  
     - `gap-4`
   - Use Tailwind variable-based colors for cards:  
     - Card bg: `bg-card`  
     - Card text: `text-card-foreground`
   - Add “View details” link/button on each card.
   - For now, use static/mock data (replace with Supabase fetch later).
   - Add debug log when a card is clicked:
     ```js
     console.debug('[OverviewCards] Card clicked:', { card });
     ```

2. **Render `OverviewCards` in `app/app/page.tsx`.**

---

### 5. Accessibility & Responsiveness

**Goal:**  
Ensure the layout is fully responsive and accessible.

**Steps:**

1. **Sidebar:**
   - Collapses to a hamburger menu (`Sheet`) on mobile.
   - Keyboard navigable (tab, enter/space to activate).
2. **Header:**
   - Profile and notification menus are accessible via keyboard.
3. **Main Content:**
   - Cards and links are focusable and have visible focus states.

---

### 6. Styling & Theming

**Goal:**  
Use only shadcn/ui and Tailwind variable-based colors for a modern, consistent look.

**Steps:**

- No hardcoded colors; use classes like `bg-primary`, `text-primary-foreground`, `bg-background`, etc.
- Use shadcn/ui components for all UI elements (Sheet, Card, Button, Avatar, DropdownMenu, etc.).
- Add Tailwind classes for spacing, border, and shadow as needed for visual polish.

---

### 7. Debug Logging

**Goal:**  
Make it easy to track user actions and layout rendering.

**Steps:**

- Add `console.debug` logs for:
  - Sidebar navigation clicks
  - Header actions (profile, notifications)
  - Overview card clicks
  - Layout render

---

## Example File Structure

```
app/
  app/
    layout.tsx         # Dashboard layout (sidebar, header, content)
    page.tsx           # Dashboard home (overview cards)
components/
  app/
    Sidebar.tsx
    Header.tsx
    OverviewCards.tsx
```

---

## Example: Sidebar Navigation Items

```ts
// components/app/Sidebar.tsx
const NAV_ITEMS = [
  { label: "Dashboard", icon: Home, href: "/app" },
  { label: "Residents", icon: Users, href: "/app/residents" },
  { label: "Payments", icon: CreditCard, href: "/app/payments" },
  { label: "Expenses", icon: Receipt, href: "/app/expenses" },
  { label: "Incidents", icon: AlertTriangle, href: "/app/incidents" },
  { label: "Announcements", icon: Megaphone, href: "/app/announcements" },
  { label: "Polls", icon: BarChart, href: "/app/polls" },
  { label: "Access Control", icon: QrCode, href: "/app/access-control" },
  { label: "Deliveries", icon: Package, href: "/app/deliveries" },
  { label: "Settings", icon: Settings, href: "/app/settings" },
  { label: "Audit Log", icon: FileText, href: "/app/audit-log" },
];
```

---

## Constraints & Guidelines

- **Do not** use any color except Tailwind variable-based colors.
- **Do not** use placeholder components for sidebar, header, or cards.
- **Do not** fetch real data yet; use static/mock data for cards.
- **Do not** use fetch or network requests in UI code.
- **Do not** use dynamic imports.
- **Do** use shadcn/ui and Lucide React for all UI and icons.
- **Do** add debug logs for all user actions and layout renders.
- **Do** ensure all UI is responsive and beautiful on all screen sizes.

---

## Deliverables

- `components/app/Sidebar.tsx` — Responsive, beautiful sidebar navigation.
- `components/app/Header.tsx` — Updated header with profile and notifications.
- `components/app/OverviewCards.tsx` — Stat cards for dashboard home.
- `app/app/layout.tsx` — Layout with sidebar, header, and main content area.
- `app/app/page.tsx` — Renders overview cards as dashboard home.

---

**Follow these steps and constraints to deliver a beautiful, robust, and debuggable core dashboard UI for MyResidency.**  
**If you need a code scaffold or more detail for any step, ask!**
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

# Resident Notification Log — Implementation Guide

## Task
Implement a **Resident Notification Log** page under `app/app/notifications/page.tsx` that displays all system notifications for the logged-in Syndic (Admin), with read/unread state, mark-as-read action, and a beautiful, responsive UI using shadcn/ui and Tailwind variable-based colors.

---

## Implementation Steps

### 1. **Page Setup**

- **Location:**  
  Create or update `app/app/notifications/page.tsx`.

- **Access Control:**  
  This page is already protected by the existing authentication middleware.  
  **Constraint:** Only authenticated users (Syndic) can access.

- **Debug Log:**  
  - Log when the page is loaded and when notifications are fetched.

---

### 2. **Data Fetching (Supabase Integration)**

- **Goal:**  
  Fetch all notifications for the current user, ordered by `created_at` (descending).

- **How:**  
  Use the browser Supabase client (`utils/supabase/client.ts`) to fetch notifications with RLS/auth.

- **Example:**
  ```typescript
  import { createSupabaseClient } from '@/utils/supabase/client'
  import { auth } from '@/lib/auth'

  // In your page or component:
  const session = await auth()
  const userId = session?.user?.id

  const supabase = await createSupabaseClient()
  const { data: notifications, error } = await supabase
    .from('notification')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.log('[NotificationLog] Error fetching notifications:', error)
  } else {
    console.log('[NotificationLog] Fetched notifications:', notifications)
  }
  ```

- **Debug Log:**  
  - Log the number of notifications fetched and any errors.

---

### 3. **UI Layout & Components**

- **Wrapper:**  
  - Use a responsive container with `bg-background` and appropriate padding.
  - Add a page title: "Notifications".

- **Notification List:**  
  - Use shadcn/ui `Card` or `List` for each notification.
  - Each notification displays:
    - **Icon** (Lucide, based on notification type)
    - **Content** (notification.content)
    - **Timestamp** (formatted, e.g., "2 hours ago")
    - **Read/Unread** badge (use `Badge` component, color-coded)
    - **Mark as Read** button (if unread)
  - Unread notifications should be visually highlighted (e.g., `bg-muted` or border).

- **Empty State:**  
  - If no notifications, show a friendly empty state with icon and message.

- **Responsiveness:**  
  - On mobile: stack notifications vertically, full width.
  - On desktop: max-width container, grid or list.

- **Styling Constraints:**  
  - Use only Tailwind variable-based colors (e.g., `bg-primary`, `text-primary-foreground`).
  - No indigo/blue unless specified.
  - Use shadcn/ui components for all UI elements.

- **Debug Log:**  
  - Log when the notification list is rendered and when the empty state is shown.

---

### 4. **Mark as Read Action**

- **Goal:**  
  Allow Syndic to mark a notification as read.

- **How:**  
  - On "Mark as Read" button click, update the notification's `read` field to `true` in Supabase.
  - Optimistically update UI for instant feedback.

- **Example:**
  ```typescript
  // On button click:
  const { error } = await supabase
    .from('notification')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', userId)

  if (error) {
    console.log('[NotificationLog] Error marking as read:', error)
  } else {
    console.log('[NotificationLog] Notification marked as read:', notificationId)
  }
  ```

- **Debug Log:**  
  - Log every mark-as-read action, including success or error.

---

### 5. **Notification Icon Mapping**

- **Goal:**  
  Show a relevant Lucide icon for each notification type.

- **How:**  
  - Map `notification.type` to a Lucide icon (e.g., 'payment' → `CreditCard`, 'incident' → `AlertCircle`, etc.).
  - Use a default icon if type is unknown.

- **Example Mapping:**
  | Type        | Icon         |
  |-------------|--------------|
  | payment     | CreditCard   |
  | incident    | AlertCircle  |
  | poll        | BarChart     |
  | announcement| Megaphone    |
  | default     | Bell         |

---

### 6. **Unread Count Badge in Header**

- **Goal:**  
  Show unread notification count as a badge on the bell icon in the main header.

- **How:**  
  - Fetch unread count in the header component (`components/app/Header.tsx`).
  - Display a `Badge` with the count on the bell icon.
  - Update in real-time when notifications are marked as read.

- **Debug Log:**  
  - Log the unread count every time it is fetched or updated.

---

### 7. **Accessibility & Usability**

- **Keyboard navigation:**  
  - Ensure all actions (mark as read) are accessible via keyboard.

- **ARIA labels:**  
  - Add ARIA labels to notification items and action buttons.

---

### 8. **File Structure & Naming**

- **Page:**  
  - `app/app/notifications/page.tsx`

- **Component (optional):**  
  - If logic/UI is complex, extract to `components/app/NotificationsList.tsx`

---

## Example UI Structure

```tsx
// Pseudocode for notification card
<Card className={cn("flex items-start gap-4", !notification.read && "bg-muted")}>
  <Icon className="text-primary" />
  <div className="flex-1">
    <div className="flex items-center gap-2">
      <span className="font-medium">{notification.content}</span>
      <Badge variant={notification.read ? "secondary" : "destructive"}>
        {notification.read ? "Read" : "Unread"}
      </Badge>
    </div>
    <span className="text-xs text-muted-foreground">{formattedDate}</span>
  </div>
  {!notification.read && (
    <Button size="sm" onClick={markAsRead}>Mark as Read</Button>
  )}
</Card>
```

---

## Debug Log Checklist

- `[NotificationLog] Page loaded`
- `[NotificationLog] Fetched notifications:`, notifications
- `[NotificationLog] Error fetching notifications:`, error
- `[NotificationLog] Notification marked as read:`, notificationId
- `[NotificationLog] Error marking as read:`, error
- `[NotificationLog] Rendered notification list`
- `[NotificationLog] Empty state shown`
- `[Header] Unread notification count:`, count

---

## Constraints & Guidelines

- **Do not use fetch or direct network requests; always use Supabase client.**
- **Do not use dynamic imports.**
- **All UI must use shadcn/ui and Tailwind variable-based colors.**
- **No placeholder components for notification list.**
- **All actions must be logged for debugging.**
- **UI must be beautiful, modern, and responsive.**
- **No code for testing, review, or unrelated setup.**

---

## Deliverables

- `app/app/notifications/page.tsx` with full notification log UI and logic.
- Updated `components/app/Header.tsx` to show unread badge.
- All debug logs as specified.

---

**Follow these steps exactly to deliver a robust, beautiful, and maintainable Resident Notification Log for the MyResidency Admin Dashboard.**
# Authentication & Navigation Management System

## Overview

This document describes the comprehensive authentication and navigation management system implemented in SAKAN to prevent confusion between browser navigation (back/forward buttons) and user-initiated auth actions (sign in/sign out).

## Problem Statement

Without proper management:
- Users logging out could use the browser back button to return to authenticated pages
- Browser navigation events could be confused with intentional sign-out actions
- Session state could become inconsistent across tabs
- Users might experience unexpected redirects or authentication loops

## Solution Architecture

### 1. Auth Navigation Manager (`lib/auth-navigation.ts`)

A centralized utility class that manages authentication state and navigation behavior:

#### Key Features:

**Session State Tracking**
- Stores user ID in `sessionStorage` when authenticated
- Clears state on logout
- Persists across page navigations within the same tab

**Logout Marking**
- Distinguishes user-initiated logout from browser navigation
- Uses time-based flag (5-second window) to detect intentional logouts
- Prevents back button from returning to authenticated pages after logout

**Navigation Protection**
- `preventBackAfterLogout()`: Blocks back navigation to authenticated pages
- Pushes history state to intercept back button
- Redirects to home page when logout is detected

**Visibility Handling**
- Detects when user switches tabs or returns to the page
- Refreshes session to check if user logged out in another tab
- Prevents stale authenticated state

### 2. Enhanced Sign-Out Handlers

All sign-out implementations now:

1. **Mark the logout** - `AuthNavigationManager.markLogout()`
2. **Clear auth state** - `AuthNavigationManager.clearAuthState()`
3. **Prevent default events** - `e.preventDefault()` and `e.stopPropagation()`
4. **Use `window.location.replace()`** - Prevents back button from returning to logged-out page

#### Implementations:

**Syndic User Menu** (`components/user/UserMenu.tsx`)
```typescript
const handleSignOut = async (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  
  AuthNavigationManager.markLogout();
  AuthNavigationManager.clearAuthState();
  
  await signOut({ callbackUrl: '/', redirect: true });
};
```

**Admin Header** (`components/admin/AdminHeader.tsx`)
```typescript
onClick={async (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  await fetch('/api/admin/auth/logout', { method: 'POST' });
  window.location.replace('/');
}}
```

**Verification Pages** (document-upload, verification-pending, etc.)
```typescript
onClick={async (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  AuthNavigationManager.markLogout();
  AuthNavigationManager.clearAuthState();
  
  await signOut({ redirect: false });
  window.location.replace('/');
}}
```

### 3. Session Check Endpoint (`app/api/auth/session-check/route.ts`)

A dedicated API endpoint to verify authentication status without full page reload:

- Returns `{ authenticated: true/false, user: {...} }`
- Used by periodic session checks
- Helps detect session expiration or logout in other tabs

### 4. Enhanced Auth Hook (`hooks/useAuthSession.ts`)

A custom React hook that wraps NextAuth's `useSession` with additional features:

**Features:**
- Automatic auth state saving
- Periodic session validation (default: 60 seconds)
- Back navigation protection
- Page visibility handling
- Session refresh on tab focus
- Required authentication enforcement

**Usage:**
```typescript
const { session, status, isAuthenticated, user } = useAuthSession({
  required: true,
  onUnauthenticated: () => router.push('/login'),
  checkInterval: 60000 // 1 minute
});
```

## Implementation Details

### Session Storage Keys

- `sakan_auth_state` - Stores current user ID
- `sakan_logout_initiated` - Boolean flag for user-initiated logout
- `sakan_logout_initiated_time` - Timestamp of logout action

### Navigation Flow

#### Sign Out Flow:
1. User clicks sign-out button
2. Event handlers prevent default behavior
3. `AuthNavigationManager.markLogout()` sets logout flag
4. `AuthNavigationManager.clearAuthState()` clears session storage
5. Sign-out API is called
6. `window.location.replace('/')` redirects to home (no history entry)

#### Back Button After Logout:
1. User presses back button
2. `preventBackAfterLogout()` detects logout flag
3. `window.location.replace('/')` redirects to home
4. User cannot navigate back to authenticated pages

#### Cross-Tab Logout:
1. User logs out in Tab A
2. User switches to Tab B (still authenticated)
3. `visibilitychange` event triggers
4. `setupVisibilityHandler()` checks auth state
5. Detects logout in other tab
6. Redirects Tab B to home page

### Browser Compatibility

The system uses:
- `sessionStorage` - Supported in all modern browsers
- `visibilitychange` API - Supported in all modern browsers
- `popstate` event - Standard HTML5 History API
- `window.history.pushState()` - Standard HTML5 History API

## Integration Points

### Pages Updated:
- ✅ `/app/verify-email-code` - Email verification with exit button
- ✅ `/app/document-upload` - Document upload with proper logout
- ✅ `/app/verification-pending` - Verification status page
- ✅ `/admin/*` - Admin dashboard pages

### Components Updated:
- ✅ `UserMenu` - Syndic user menu in header
- ✅ `AdminHeader` - Admin dashboard header

## Testing Scenarios

### 1. Normal Sign-Out
- [x] Click sign-out button
- [x] Verify redirect to home page
- [x] Try back button - should stay on home page

### 2. Browser Back After Logout
- [x] Log in
- [x] Navigate to authenticated page
- [x] Log out
- [x] Press browser back button
- [x] Should stay on home page (not return to authenticated page)

### 3. Cross-Tab Logout
- [x] Open app in two tabs (Tab A and Tab B)
- [x] Log out in Tab A
- [x] Switch to Tab B
- [x] Tab B should detect logout and redirect to home

### 4. Session Expiration
- [x] Log in
- [x] Wait for session to expire (or manually expire session)
- [x] Perform any action
- [x] Should redirect to login page

### 5. Page Refresh
- [x] Log in
- [x] Refresh page
- [x] Should remain authenticated
- [x] Session state should persist

### 6. Browser Forward After Logout
- [x] Log in → Navigate → Log out
- [x] Press back (stays on home)
- [x] Press forward
- [x] Should stay on home page (not go to authenticated page)

## Security Considerations

1. **SessionStorage** - Data cleared when browser/tab closes
2. **Time-based Flags** - Logout flags expire after 5 seconds to prevent stale state
3. **Server-Side Validation** - All protected routes check auth on server
4. **No Client-Side Secrets** - Only user IDs stored (no tokens or sensitive data)
5. **Replace vs Push** - Using `replace()` prevents history manipulation

## Maintenance

### Adding New Protected Pages:
1. Use `useAuthSession({ required: true })` hook
2. Add `AuthNavigationManager.preventBackAfterLogout()` in useEffect
3. Mark logout in sign-out handler

### Debugging:
- Check sessionStorage in browser DevTools (Application → Storage)
- Look for `sakan_auth_state` and `sakan_logout_initiated` keys
- Check console for `[useAuthSession]` logs
- Verify navigation history in browser DevTools

## Future Enhancements

- [ ] Add session expiration warnings (30 seconds before expiry)
- [ ] Implement "Keep me logged in" option
- [ ] Add session activity tracking
- [ ] Implement concurrent session limits
- [ ] Add device management dashboard


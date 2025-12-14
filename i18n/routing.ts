import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['fr', 'en', 'ar'],

  // Used when no locale matches
  defaultLocale: 'fr',

  // The locale prefix strategy
  localePrefix: 'always' // Always show the locale prefix in the URL
});

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);


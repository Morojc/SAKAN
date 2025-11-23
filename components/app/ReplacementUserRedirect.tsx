'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function ReplacementUserRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Only redirect if we are NOT already on the validate-code page
    if (pathname && !pathname.includes('/validate-code')) {
      console.log('[ReplacementUserRedirect] Redirecting to /app/validate-code');
      router.push('/app/validate-code');
    }
  }, [pathname, router]);

  return null;
}

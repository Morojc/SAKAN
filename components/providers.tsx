'use client';

import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
	// Clean up browser extension attributes that cause hydration mismatches
	useEffect(() => {
		// Remove extension-added attributes from body tag after hydration
		if (typeof window !== 'undefined' && document.body) {
			// Remove common extension attributes
			const extensionAttributes = [
				'cz-shortcut-listen',
				'data-new-gr-c-s-check-loaded',
				'data-gr-ext-installed',
			];
			
			extensionAttributes.forEach(attr => {
				if (document.body.hasAttribute(attr)) {
					document.body.removeAttribute(attr);
				}
			});
		}
	}, []);

	return (
		<SessionProvider>
			{children}
		</SessionProvider>
	);
}

import type { Metadata } from "next";
import config from "@/config";
import "./globals.css";
import { GoogleTagManager } from '@next/third-parties/google'
import { OpenPanelComponent } from '@openpanel/nextjs';
import { Toaster } from 'react-hot-toast';
import FooterWrapper from "@/components/ui/FooterWrapper";
import { Providers } from "@/components/providers";
import { DevelopmentBanner } from "@/components/DevelopmentBanner";
import { auth } from "@/lib/auth";
import { checkRequiredEnvVars } from "@/lib/env-check";

export const metadata: Metadata = config.metadata;

// Force dynamic rendering since we need to check authentication
export const dynamic = 'force-dynamic';

// Check environment variables on server startup
if (typeof window === 'undefined') {
  checkRequiredEnvVars();
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Safely get session with error handling
  let session = null;
  try {
    session = await auth();
  } catch (error) {
    console.error('[Root Layout] Failed to get session:', error);
    // Session will be null, but app will still render
  }

  return (
    <html lang="en" suppressHydrationWarning>
			<body className="antialiased min-h-screen flex flex-col" suppressHydrationWarning>
				<Providers session={session}>
          <DevelopmentBanner />
          <div className="pt-12 sm:pt-10">
            <Toaster position="top-center" />
            <main className="flex-grow">
              {children}
            </main>
            <FooterWrapper />
          </div>
				</Providers>
        </body>
      {/* Google Tag Manager */}
      {process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID && (
        <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID} />
      )}
      
      {/* OpenPanel Analytics */}
      {process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID && (
        <OpenPanelComponent
          clientId={process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID}
          trackScreenViews={true}
          // trackAttributes={true}
          // trackOutgoingLinks={true}
          // If you have a user id, you can pass it here to identify the user
          // profileId={'123'}
        />
      )}
    </html>
  );
}

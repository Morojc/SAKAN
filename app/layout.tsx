import type { Metadata } from "next";
import config from "@/config";
import "./globals.css";
import { GoogleTagManager } from '@next/third-parties/google'
import { OpenPanelComponent } from '@openpanel/nextjs';
import { Toaster } from 'react-hot-toast';
import FooterWrapper from "@/components/ui/FooterWrapper";
import { Providers } from "@/components/providers";
import { DevelopmentBanner } from "@/components/DevelopmentBanner";

export const metadata: Metadata = config.metadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
			<body className="antialiased min-h-screen flex flex-col" suppressHydrationWarning>
				<Providers>
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

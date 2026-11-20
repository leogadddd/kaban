import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { SPLASH_SCRIPT, THEME_SCRIPT } from "@/lib/theme-script";
import { ChestArt } from "@/components/chest-art";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  // App screens are personal and device-local: keep them out of search. The landing page opts back in.
  robots: { index: false, follow: false },
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en_PH" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // App-like: no pinch or double-tap zoom (inputs are 16px so iOS never auto-zooms on focus).
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // theme-color is set by THEME_SCRIPT so it follows the light/dark choice.
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-PH" className={`${geistSans.variable} ${geistMono.variable} antialiased`} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: SPLASH_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        {/* Launch splash: plain HTML + CSS so it paints before the app's JavaScript arrives (globals.css). */}
        <div id="splash" aria-hidden="true">
          <ChestArt eyes="open" effects={false} className="splash-chest" />
          <p className="splash-name">Kaban</p>
        </div>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

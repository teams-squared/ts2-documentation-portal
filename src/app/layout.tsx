import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import Providers from "@/components/auth/Providers";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { AmbientMotionGate } from "@/components/layout/AmbientMotionGate";
import PostHogIdentify from "@/components/analytics/PostHogIdentify";
import PostHogPageView from "@/components/analytics/PostHogPageView";
import "./globals.css";

// Inter — body / UI font (see design-system Section 4.1)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Plus Jakarta Sans — display / headings font (design-system Section 4.1).
// Exposed as `--font-jakarta`; `--font-display` (the Tailwind utility token)
// is composed in globals.css from this variable. Naming the next/font variable
// the same as the Tailwind token would create a circular CSS-var reference.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Teams Squared LMS",
  description: "Learning Management System for Teams Squared",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground font-sans">
        {/* Skip-to-content for keyboard users (design-system §10). Hidden by
            default, becomes visible on focus. Targets DashboardShell's <main>. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Skip to content
        </a>
        <Providers>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          <PostHogIdentify />
          <AmbientMotionGate />
          <DashboardShell>{children}</DashboardShell>
        </Providers>
      </body>
    </html>
  );
}

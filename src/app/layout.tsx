import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "翡翠进销存管理系统",
  description: "翡翠珠宝进销存管理 - 库存/销售/批次/客户一体化管理",
  keywords: ["翡翠", "珠宝", "进销存", "库存管理", "销售管理"],
  authors: [{ name: "Z.ai Team" }],
  icons: {
    icon: "/logo.svg",
  },
};

/**
 * Inline script for standalone deployment:
 * - Basic iframe escape (clickjacking protection)
 * - No aggressive fetch monitoring or DOM cleanup needed
 */
const standaloneInitScript = `
(function() {
  'use strict';

  // If embedded in an iframe, try to break out (anti-clickjacking)
  try {
    if (window.self !== window.top) {
      try {
        window.top.location.href = window.self.location.href;
      } catch (e) {
        // Cross-origin iframe - can't break out, log warning
        console.warn('[Jade] Running inside cross-origin iframe - some features may be limited');
      }
    }
  } catch (e) {
    // window.top access failed - we're in a cross-origin iframe
    console.warn('[Jade] Running inside iframe - some features may be limited');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* Standalone init script - runs before React hydration */}
        <script dangerouslySetInnerHTML={{ __html: standaloneInitScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}

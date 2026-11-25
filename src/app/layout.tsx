import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { getActiveTheme } from "@/lib/theme";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SYCC Youth Growth & Discipleship",
    template: "%s | SYCC Youth",
  },
  description:
    "Relational discipleship, Saturday attendance, cell care, and treasury stewardship for SYCC Youth.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SYCC Youth",
  },
};

export const viewport: Viewport = {
  themeColor: "#1E3A8A",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const activeTheme = await getActiveTheme();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={
        {
          "--color-primary": activeTheme.primary_color,
          "--color-accent": activeTheme.accent_color,
          "--banner-gradient": activeTheme.banner_gradient,
        } as React.CSSProperties
      }
    >
      <body className="min-h-full bg-[#F8FAFC] text-slate-900">
        <ThemeProvider theme={activeTheme}>
          <ServiceWorkerRegister />
          <OfflineBanner />
          {children}
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}

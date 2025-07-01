import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ActivityLogProvider } from "@/contexts/ActivityLogContext";
import { ActivityLogWrapper } from "@/components/ActivityLogWrapper";
import { Toaster } from "sonner";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Watcher Pro - AI-Powered Show Production Tool",
  description: "Watch Everything. Miss Nothing. The AI-powered show production tool for livestreamers.",
  keywords: ["livestream", "news analysis", "show production", "content creation", "watching the watchers"],
  openGraph: {
    title: "Watcher Pro",
    description: "AI-powered show production tool for livestreamers",
    url: "https://watcherpro.ai",
    siteName: "Watcher Pro",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <AuthProvider>
            <ActivityLogProvider>
              {children}
              <ActivityLogWrapper />
              <Toaster richColors position="top-right" />
            </ActivityLogProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ActivityLogProvider } from "@/contexts/ActivityLogContext";
import { ActivityLog } from "@/components/ActivityLog";
import { Toaster } from "sonner";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Story Bundler - Livestream Show Producer",
  description: "Organize news stories into segments for your livestream",
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
              <ActivityLog />
              <Toaster richColors position="top-right" />
            </ActivityLogProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

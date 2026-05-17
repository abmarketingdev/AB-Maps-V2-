import type { ReactNode } from "react";
import './globals.css';
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { CampaignsProvider } from "@/components/campaign/CampaignsContext";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { CompletionProvider } from "@/contexts/CompletionContext";
import CampaignGuard from "@/components/campaign/CampaignGuard";

export const metadata = {
  generator: "v0.dev",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet" />
      </head>
      <body className="bg-background text-foreground font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            <CompletionProvider>
              <CampaignsProvider>
                <CampaignGuard>
                  {children}
                </CampaignGuard>
              </CampaignsProvider>
            </CompletionProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

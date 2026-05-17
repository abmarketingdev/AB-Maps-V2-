import type { ReactNode } from "react";
import './globals.css';
import { CampaignsProvider } from "@/components/campaign/CampaignsContext";
import { AuthProvider } from "@/lib/auth/AuthContext";
import CampaignGuard from "@/components/campaign/CampaignGuard";

export const metadata = {
  generator: "v0.dev",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <CampaignsProvider>
            <CampaignGuard>
              {children}
            </CampaignGuard>
          </CampaignsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
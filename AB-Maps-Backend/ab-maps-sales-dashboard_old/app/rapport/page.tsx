'use client'
import ClientLayout from "../ClientLayout";
import RapportTable from "@/components/rapport-table"
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";

export default function RapportPage() {
  return (
    <ProtectedRoute>
      <ClientLayout>
        <div className="flex min-h-screen flex-col bg-muted/40">
          <div className="flex-1 space-y-4 p-4 md:p-8">
            <div className="flex items-center justify-between space-y-2">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Rapport</h2>
                <p className="text-muted-foreground">Detaljert oversikt over agentytelse og kampanjestatistikk</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <RapportTable />
            </div>
          </div>
        </div>
      </ClientLayout>
    </ProtectedRoute>
  )
}

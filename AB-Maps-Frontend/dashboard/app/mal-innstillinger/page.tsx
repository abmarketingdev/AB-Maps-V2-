"use client"

import ClientLayout from "../ClientLayout"
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute"
import { MalInnstillinger } from "@/components/dashboard/leader/MalInnstillinger"

// Goal-settings page (2026-08-06). Segmented by Sales Chief → their teams.
// Separate Campaigns section for HR-staff. Reuses SetTeamGoalModal +
// SetCampaignGoalModal for inline edits so pencil buttons on team cards + this
// admin view all write to the same endpoint (single source of truth).
//
// Route auth: manager and up (matches /dashbord). Server enforces per-team
// can_edit and per-campaign HR-staff-only regardless of who reaches this URL.

export default function Page() {
  return (
    <ProtectedRoute requiredUserType="manager">
      <ClientLayout>
        <MalInnstillinger />
      </ClientLayout>
    </ProtectedRoute>
  )
}

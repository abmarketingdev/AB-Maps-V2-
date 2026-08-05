/**
 * Demo-mode auth bypass helper. ONLY used when NEXT_PUBLIC_DEMO_MODE=true.
 * Returns a fake User object matching the AuthContext shape so ProtectedRoute
 * passes without contacting the real auth backend.
 *
 * Prod behaviour is unchanged — DEMO env var unset → this file is never called.
 */

export type DemoRole = "admin" | "manager" | "chief" | "employee"

// The User interface from AuthContext.tsx.
// Kept in sync with lib/auth/authService.ts's UserInfo.
export interface DemoUser {
  user_id: string
  username: string
  email: string
  user_type: "superuser" | "manager" | "employee" | "admin"
  is_sales_chief?: boolean
  user_info: {
    id: string
    name: string
    email: string
    manager_id?: string | null
    ab_person_id?: string | null
    is_superuser?: boolean
    is_staff?: boolean
    admin_type?: string | null
    employee_type?: string | null
  }
}

export function makeDemoUser(role: DemoRole): DemoUser {
  const roleMap: Record<DemoRole, DemoUser> = {
    admin: {
      user_id: "demo-admin",
      username: "admin_lars",
      email: "lars@abmarketing.no",
      user_type: "superuser",
      is_sales_chief: false,
      user_info: {
        id: "demo-admin", name: "Lars Andersen", email: "lars@abmarketing.no",
        manager_id: null, ab_person_id: "AB001",
        is_superuser: true, is_staff: true, admin_type: "maps_admin", employee_type: null,
      },
    },
    manager: {
      user_id: "demo-manager",
      username: "kari.nordmann",
      email: "kari@abmarketing.no",
      user_type: "manager",
      is_sales_chief: false,
      user_info: {
        id: "demo-manager", name: "Kari Nordmann", email: "kari@abmarketing.no",
        manager_id: null, ab_person_id: "AB002",
        is_superuser: false, is_staff: true, admin_type: null, employee_type: null,
      },
    },
    chief: {
      user_id: "demo-chief",
      username: "andreas.rikstad",
      email: "andreas@abmarketing.no",
      user_type: "manager",
      is_sales_chief: true,
      user_info: {
        id: "demo-chief", name: "Andreas Rikstad", email: "andreas@abmarketing.no",
        manager_id: null, ab_person_id: "AB003",
        is_superuser: false, is_staff: true, admin_type: null, employee_type: null,
      },
    },
    employee: {
      user_id: "demo-emp",
      username: "ida.solberg",
      email: "ida@abmarketing.no",
      user_type: "employee",
      is_sales_chief: false,
      user_info: {
        id: "demo-emp", name: "Ida Solberg", email: "ida@abmarketing.no",
        manager_id: "demo-chief", ab_person_id: "AB010",
        is_superuser: false, is_staff: false, admin_type: null, employee_type: "maps_emp",
      },
    },
  }
  return roleMap[role]
}

const STORAGE_KEY = "ab_demo_as"

export const demoAuth = {
  DEMO: process.env.NEXT_PUBLIC_DEMO_MODE === "true",

  set(role: DemoRole) {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEY, role)
  },

  get(): DemoRole | null {
    if (typeof window === "undefined") return null
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === "admin" || raw === "manager" || raw === "chief" || raw === "employee") return raw
    return null
  },

  clear() {
    if (typeof window === "undefined") return
    localStorage.removeItem(STORAGE_KEY)
  },
}

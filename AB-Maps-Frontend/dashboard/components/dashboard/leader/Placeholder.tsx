"use client"

// Wraps any value that comes from dummyData.ts instead of a real API.
// Renders indistinguishably from production data in the UI, but tags the
// DOM node with data-placeholder="true" so `grep -r 'data-placeholder' components/dashboard/leader/`
// enumerates every unresolved gap when the backend is ready.
export function Placeholder({ children }: { children: React.ReactNode }) {
  return <span data-placeholder="true">{children}</span>
}

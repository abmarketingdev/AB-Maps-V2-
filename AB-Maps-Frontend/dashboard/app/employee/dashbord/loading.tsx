// Skeleton shown IMMEDIATELY by Next.js router while /employee/dashbord
// chunks download + parse. Perceived-perf win on mobile promoter view.
export default function Loading() {
  return (
    <div className="min-h-screen bg-ab-base">
      <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        {/* Hero panel skeleton */}
        <div className="rounded-[28px] border border-ab-line bg-ab-elevated h-32 animate-pulse" />
        {/* Din dag section skeleton */}
        <div className="space-y-3">
          <div className="h-4 w-20 rounded bg-ab-elevated animate-pulse" />
          <div className="h-64 w-full rounded-2xl border border-ab-line bg-ab-elevated animate-pulse" />
        </div>
        {/* LØNN section skeleton */}
        <div className="space-y-3">
          <div className="h-4 w-12 rounded bg-ab-elevated animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 rounded-2xl border border-ab-line bg-ab-elevated animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

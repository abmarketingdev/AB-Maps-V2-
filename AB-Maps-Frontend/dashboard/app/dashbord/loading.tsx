// Skeleton shown IMMEDIATELY by Next.js router while the page's JS chunks
// download + parse. Massive perceived-perf win on mobile — users see the
// dashboard shape right away instead of a blank screen for 2-4 seconds.
export default function Loading() {
  return (
    <div className="min-h-screen bg-ab-base">
      <div className="relative max-w-[1600px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        {/* Hero panel skeleton */}
        <div className="rounded-[28px] border border-ab-line bg-ab-elevated h-40 animate-pulse" />
        {/* TEAM section skeleton */}
        <div className="space-y-3">
          <div className="h-4 w-24 rounded bg-ab-elevated animate-pulse" />
          <div className="h-24 w-full rounded-2xl border border-ab-line bg-ab-elevated animate-pulse" />
          <div className="h-24 w-full rounded-2xl border border-ab-line bg-ab-elevated animate-pulse" />
        </div>
        {/* LØNN section skeleton */}
        <div className="space-y-3">
          <div className="h-4 w-16 rounded bg-ab-elevated animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl border border-ab-line bg-ab-elevated animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

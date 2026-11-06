export default function Loading() {
  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col">
      <div className="h-14 shrink-0 animate-pulse bg-[#E0E0E0]" />
      <div className="flex flex-1">
        <div className="w-[260px] shrink-0 animate-pulse border-r border-[#E0E0E0] bg-[#f7f7f7]" />
        <div className="min-w-0 flex-1 animate-pulse bg-[#f7f7f7] p-6">
          <div className="mx-auto max-w-2xl space-y-4">
            <div className="h-12 rounded-lg bg-[#E0E0E0]" />
            <div className="h-24 rounded-lg bg-[#E0E0E0]" />
            <div className="h-32 rounded-lg bg-[#E0E0E0]" />
          </div>
        </div>
        <div className="hidden w-[360px] shrink-0 animate-pulse border-l border-[#E0E0E0] bg-[#f7f7f7] lg:block" />
      </div>
    </div>
  );
}

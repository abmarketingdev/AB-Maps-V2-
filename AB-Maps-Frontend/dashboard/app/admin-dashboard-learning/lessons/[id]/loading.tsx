export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse space-y-6 p-6">
      <div className="h-10 w-3/4 rounded bg-[#E0E0E0]" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="h-24 rounded-lg bg-[#E0E0E0]" />
          <div className="h-48 rounded-lg bg-[#E0E0E0]" />
        </div>
        <div className="h-64 rounded-lg bg-[#E0E0E0]" />
      </div>
    </div>
  );
}

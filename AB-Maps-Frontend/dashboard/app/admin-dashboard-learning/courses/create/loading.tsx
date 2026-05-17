export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="h-8 w-64 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 w-96 bg-gray-200 rounded"></div>
        </div>
        
        {/* Content skeleton */}
        <div className="h-96 bg-gray-200 rounded-lg"></div>
      </div>
    </div>
  );
}

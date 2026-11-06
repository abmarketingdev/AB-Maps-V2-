export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="h-16 bg-gray-200 border-b border-gray-200"></div>
        
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Table skeleton */}
          <div className="h-96 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    </div>
  );
}


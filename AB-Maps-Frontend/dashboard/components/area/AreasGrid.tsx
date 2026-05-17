import React, { memo, useCallback } from "react";
import AreaCard from "./AreaCard";
import { Area } from "@/services/areaService";

interface AreasGridProps {
  areas: Area[];
  loading: boolean;
  error?: string | null;
  onEdit: (area: Area) => void;
  onAssignEmployees: (area: Area) => void;
  onDelete: (area: Area) => void;
}

const AreasGrid = memo(function AreasGrid({ 
  areas, 
  loading,
  error, 
  onEdit, 
  onAssignEmployees, 
  onDelete 
}: AreasGridProps) {
  
  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-red-50 to-red-100 rounded-full flex items-center justify-center mb-4 shadow-sm">
          <svg 
            className="w-10 h-10 text-red-500" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        </div>
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Error Loading Areas</h3>
        <p className="text-gray-600 max-w-md text-sm sm:text-base mb-4">
          {error || "Something went wrong while loading areas. Please try again."}
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
        >
          Reload Page
        </button>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div 
            key={i} 
            className="bg-white rounded-lg shadow border border-l-4 border-l-gray-200 p-4 sm:p-5 animate-pulse"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-5 h-5 sm:w-4 sm:h-4 rounded-full bg-gray-200 flex-shrink-0" />
              <div className="h-5 sm:h-6 bg-gray-200 rounded w-2/3" />
            </div>
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-9 sm:h-10 bg-gray-200 rounded" />
              <div className="h-9 sm:h-10 bg-gray-200 rounded" />
              <div className="h-9 sm:h-10 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (areas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full flex items-center justify-center mb-4 shadow-sm">
          <svg 
            className="w-10 h-10 text-blue-500" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
            />
          </svg>
        </div>
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Ingen områder funnet</h3>
        <p className="text-gray-600 max-w-md text-sm sm:text-base">
          Det er ingen områder tilgjengelig for den valgte kampanjen. Prøv å velge en annen kampanje eller opprett et nytt område.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {areas.map((area) => (
        <AreaCard
          key={area.id}
          area={area}
          onEdit={onEdit}
          onAssignEmployees={onAssignEmployees}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
});

export default AreasGrid;


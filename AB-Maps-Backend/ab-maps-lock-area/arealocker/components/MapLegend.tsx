'use client';

import React from 'react';

interface MapLegendProps {
  open?: number;
  closed?: number;
  total?: number;
}

export default function MapLegend({ open = 0, closed = 0, total = 0 }: MapLegendProps) {
  return (
    <div className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-md shadow-md z-10">
      <h3 className="text-sm font-semibold mb-2 text-gray-900 dark:text-white">Tegnforklaring</h3>
      <div className="space-y-2">
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-sm bg-green-500 mr-2"></div>
          <span className="text-xs text-gray-700 dark:text-gray-300">Alle områder åpne</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-sm bg-yellow-500 mr-2"></div>
          <span className="text-xs text-gray-700 dark:text-gray-300">Noen områder åpne</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-sm bg-red-500 mr-2"></div>
          <span className="text-xs text-gray-700 dark:text-gray-300">Alle områder lukket</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-sm bg-gray-300 dark:bg-gray-600 mr-2"></div>
          <span className="text-xs text-gray-700 dark:text-gray-300">Ingen områder</span>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { ViewMode } from '@/types';

interface AreaToggleViewProps {
  onViewChange: (view: ViewMode) => void;
  currentView: ViewMode;
}

export default function AreaToggleView({ onViewChange, currentView }: AreaToggleViewProps) {
  const handleToggle = () => {
    const newView = currentView === 'list' ? 'map' : 'list';
    onViewChange(newView);
  };

  return (
    <div className="flex items-center justify-center mb-6">
      <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
        <button
          onClick={() => onViewChange('list')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
            currentView === 'list'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Listevisning
        </button>
        <button
          onClick={() => onViewChange('map')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
            currentView === 'map'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Kartvisning
        </button>
      </div>
    </div>
  );
}

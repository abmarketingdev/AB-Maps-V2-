import { useState } from 'react';
import { Area } from '@/types';
import { format } from 'date-fns';

interface AreaRowProps {
  area: Area;
  onToggleStatus: (area: Area) => Promise<Area>;
}

export default function AreaRow({ area, onToggleStatus }: AreaRowProps) {
  const formattedDate = format(new Date(area.created_at), 'dd.MM.yyyy HH:mm');
  const [optimisticStatus, setOptimisticStatus] = useState<'open' | 'closed' | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  
  // Get the current status, prioritizing the optimistic status if it exists
  const currentStatus = optimisticStatus || area.status;
  
  return (
    <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
        {area.id}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        {area.campaign_name}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        <span className="flex items-center">
          <span className="mr-1">🇳🇴</span>
          {area.fylke}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        {area.bydel || '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            currentStatus === 'open'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}
        >
          {currentStatus === 'open' ? 'Åpen' : 'Lukket'}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        {area.created_by}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        {formattedDate}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button
          onClick={() => {
            if (window.confirm(`Er du sikker på at du vil ${currentStatus === 'open' ? 'lukke' : 'åpne'} denne kampanjen?`)) {
              // Set optimistic status immediately for UI update
              const newStatus = currentStatus === 'open' ? 'closed' : 'open';
              setOptimisticStatus(newStatus);
              setIsToggling(true);
              
              // Call the actual toggle function
              onToggleStatus({...area, status: currentStatus})
                .then(() => {
                  // Reset optimistic status after successful update
                  setOptimisticStatus(null);
                })
                .catch(() => {
                  // Revert optimistic status on error
                  setOptimisticStatus(currentStatus);
                })
                .finally(() => {
                  setIsToggling(false);
                });
            }
          }}
          disabled={isToggling}
          className={`px-3 py-1 rounded-md text-white ${
            currentStatus === 'open'
              ? 'bg-amber-500 hover:bg-amber-600'
              : 'bg-green-500 hover:bg-green-600'
          } ${isToggling ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {isToggling ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {currentStatus === 'open' ? 'Lukker...' : 'Åpner...'}
            </span>
          ) : (
            currentStatus === 'open' ? 'Lukk' : 'Åpne'
          )}
        </button>
      </td>
    </tr>
  );
}

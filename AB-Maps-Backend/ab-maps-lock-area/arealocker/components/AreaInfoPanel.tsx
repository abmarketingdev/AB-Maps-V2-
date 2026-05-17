import { useState } from 'react';
import { Area } from '@/types';
import { format } from 'date-fns';

interface AreaInfoPanelProps {
  area: Area | null;
  onClose: () => void;
  onToggleStatus: (area: Area) => Promise<Area>;
}

export default function AreaInfoPanel({ area, onClose, onToggleStatus }: AreaInfoPanelProps) {
  const [isToggling, setIsToggling] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<'open' | 'closed' | null>(null);

  if (!area) return null;

  // Get the current status, prioritizing the optimistic status if it exists
  const currentStatus = optimisticStatus || area.status;
  const formattedDate = format(new Date(area.created_at), 'dd.MM.yyyy HH:mm');

  const handleToggleStatus = async () => {
    if (window.confirm(`Er du sikker på at du vil ${currentStatus === 'open' ? 'lukke' : 'åpne'} dette området?`)) {
      // Set optimistic status immediately for UI update
      const newStatus = currentStatus === 'open' ? 'closed' : 'open';
      setOptimisticStatus(newStatus);
      setIsToggling(true);
      
      try {
        // Call the actual toggle function
        await onToggleStatus({...area, status: currentStatus});
        // Reset optimistic status after successful update
        setOptimisticStatus(null);
      } catch (error) {
        // Revert optimistic status on error
        setOptimisticStatus(currentStatus);
        console.error('Error toggling status:', error);
      } finally {
        setIsToggling(false);
      }
    }
  };

  return (
    <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 z-10 w-80">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Områdeinformasjon
        </h3>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Navn</p>
          <p className="text-base text-gray-900 dark:text-white">{area.campaign_name}</p>
        </div>
        
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Fylke</p>
          <p className="text-base text-gray-900 dark:text-white">{area.fylke}</p>
        </div>
        
        {area.bydel && (
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Bydel</p>
            <p className="text-base text-gray-900 dark:text-white">{area.bydel}</p>
          </div>
        )}
        
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</p>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              currentStatus === 'open'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}
          >
            {currentStatus === 'open' ? 'Åpen' : 'Lukket'}
          </span>
        </div>
        
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Opprettet av</p>
          <p className="text-base text-gray-900 dark:text-white">{area.created_by}</p>
        </div>
        
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Opprettet dato</p>
          <p className="text-base text-gray-900 dark:text-white">{formattedDate}</p>
        </div>
        
        <div className="pt-2">
          <button
            onClick={handleToggleStatus}
            disabled={isToggling}
            className={`w-full px-4 py-2 rounded-md text-white ${
              currentStatus === 'open'
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-green-500 hover:bg-green-600'
            } ${isToggling ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isToggling ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {currentStatus === 'open' ? 'Lukker...' : 'Åpner...'}
              </span>
            ) : (
              currentStatus === 'open' ? 'Lukk område' : 'Åpne område'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

import { Area } from '@/types';
import { useState, useEffect } from 'react';

interface ToggleStatusModalProps {
  area: Area | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (area: Area) => Promise<Area>;
}

export default function ToggleStatusModal({ 
  area, 
  isOpen, 
  onClose, 
  onConfirm 
}: ToggleStatusModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Reset loading state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsLoading(false);
    }
  }, [isOpen]);

  if (!area) return null;

  const handleConfirm = async () => {
    setIsLoading(true);
    await onConfirm(area);
    setIsLoading(false);
    onClose();
  };

  const newStatus = area.status === 'open' ? 'closed' : 'open';

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md p-6 mx-auto bg-white rounded-lg shadow-xl dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">
              Confirm Status Change
            </h3>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to change the status of area <span className="font-medium">{area.campaign_name}</span> from <span className="font-medium">{area.status}</span> to <span className="font-medium">{newStatus}</span>?
            </p>
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                disabled={isLoading}
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-700 dark:hover:bg-blue-800"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-2 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

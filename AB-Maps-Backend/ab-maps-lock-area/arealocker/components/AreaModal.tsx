'use client';

import { useState } from 'react';
import { Area } from '@/types';
import { format } from 'date-fns';

interface AreaModalProps {
  isOpen: boolean;
  onClose: () => void;
  fylke: string | null;
  areas: Area[];
  onToggleStatus: (area: Area) => void;
  isToggling: boolean;
}

export default function AreaModal({ 
  isOpen, 
  onClose, 
  fylke, 
  areas, 
  onToggleStatus,
  isToggling 
}: AreaModalProps) {
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!isOpen || !fylke) return null;

  const handleToggleClick = (area: Area) => {
    setSelectedArea(area);
    setConfirmOpen(true);
  };

  const handleConfirmToggle = () => {
    if (selectedArea) {
      onToggleStatus(selectedArea);
      setConfirmOpen(false);
    }
  };

  const handleCancelToggle = () => {
    setConfirmOpen(false);
    setSelectedArea(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold flex items-center">
            <span className="mr-2">🇳🇴</span> 
            {fylke} - Områder
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 overflow-auto flex-grow">
          {areas.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              Ingen områder funnet for {fylke}
            </p>
          ) : (
            <div className="space-y-4">
              {areas.map(area => (
                <div 
                  key={area.id}
                  className="p-3 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{area.campaign_name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        ID: {area.id} | Opprettet av: {area.created_by}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {format(new Date(area.created_at), 'dd.MM.yyyy HH:mm')}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-2 ${
                        area.status === 'open' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}>
                        {area.status === 'open' ? 'Åpen' : 'Lukket'}
                      </span>
                      <button
                        onClick={() => handleToggleClick(area)}
                        disabled={isToggling}
                        className="text-sm px-2 py-1 rounded bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
                      >
                        {area.status === 'open' ? 'Lukk' : 'Åpne'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md text-center"
          >
            Lukk
          </button>
        </div>
      </div>
      
      {/* Confirmation Dialog */}
      {confirmOpen && selectedArea && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">Bekreft statusendring</h3>
            <p className="mb-4">
              Er du sikker på at du vil endre status for området "{selectedArea.campaign_name}" fra 
              <span className="font-semibold"> {selectedArea.status === 'open' ? 'åpen' : 'lukket'} </span> 
              til 
              <span className="font-semibold"> {selectedArea.status === 'open' ? 'lukket' : 'åpen'}</span>?
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={handleCancelToggle}
                disabled={isToggling}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded"
              >
                Avbryt
              </button>
              <button
                onClick={handleConfirmToggle}
                disabled={isToggling}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {isToggling ? 'Behandler...' : 'Bekreft'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

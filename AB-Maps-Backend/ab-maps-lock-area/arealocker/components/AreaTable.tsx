import { useState, useEffect } from 'react';
import { Area, norwegianCounties } from '@/types';
import { getDistrictsForCounty } from '@/data/districts';
import AreaRow from './AreaRow';

interface AreaTableProps {
  areas: Area[];
  loading: boolean;
  onToggleStatus: (area: Area) => Promise<Area>;
  currentPage: number;
  totalPages: number;
  totalAreas: number;
  onPageChange: (page: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  fylkeFilter: string;
  onFylkeFilterChange: (fylke: string) => void;
  bydelFilter?: string;
  onBydelFilterChange?: (bydel: string) => void;
}

export default function AreaTable({
  areas,
  loading,
  onToggleStatus,
  currentPage,
  totalPages,
  totalAreas,
  onPageChange,
  searchQuery,
  onSearchChange,
  fylkeFilter,
  onFylkeFilterChange,
  bydelFilter = '',
  onBydelFilterChange = () => {}
}: AreaTableProps) {
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
  
  // Update available districts when fylkeFilter changes
  useEffect(() => {
    if (fylkeFilter && fylkeFilter !== 'all') {
      setAvailableDistricts(getDistrictsForCounty(fylkeFilter));
    } else {
      setAvailableDistricts([]);
      // Reset bydel filter when no specific county is selected
      if (bydelFilter) onBydelFilterChange('');
    }
  }, [fylkeFilter, bydelFilter, onBydelFilterChange]);

  const handleToggleStatus = (area: Area): Promise<Area> => {
    // Pass through to the parent component's onToggleStatus
    return onToggleStatus(area);
  };

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Søk etter kampanjenavn
          </label>
          <input
            type="text"
            id="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Søk..."
            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md p-2"
          />
        </div>
        <div>
          <label htmlFor="fylke" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Filtrer etter fylke
          </label>
          <select
            id="fylke"
            value={fylkeFilter}
            onChange={(e) => onFylkeFilterChange(e.target.value)}
            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md p-2"
          >
            <option value="all">Alle fylker</option>
            {norwegianCounties.map(county => (
              <option key={county} value={county}>
                {county}
              </option>
            ))}
          </select>
        </div>
        
        {/* Bydel dropdown - only shown when a specific county is selected */}
        {availableDistricts.length > 0 && (
          <div>
            <label htmlFor="bydel" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Filtrer etter bydel
            </label>
            <select
              id="bydel"
              value={bydelFilter}
              onChange={(e) => onBydelFilterChange(e.target.value)}
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md p-2"
            >
              <option value="">Alle bydeler</option>
              {availableDistricts.map(district => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      
      <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
      <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
          <tr>
            <th scope="col" className="px-6 py-3">ID</th>
            <th scope="col" className="px-6 py-3">Kampanjenavn</th>
            <th scope="col" className="px-6 py-3">Fylke</th>
            <th scope="col" className="px-6 py-3">Bydel</th>
            <th scope="col" className="px-6 py-3">Status</th>
            <th scope="col" className="px-6 py-3">Opprettet av</th>
            <th scope="col" className="px-6 py-3">Opprettet</th>
            <th scope="col" className="px-6 py-3 text-right">Handlinger</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={6} className="px-6 py-4 text-center">
                <div className="flex justify-center items-center space-x-2">
                  <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Laster områder...</span>
                </div>
              </td>
            </tr>
          ) : areas.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-6 py-4 text-center">
                Ingen områder funnet
              </td>
            </tr>
          ) : (
            areas.map(area => (
              <AreaRow 
                key={area.id} 
                area={area} 
                onToggleStatus={handleToggleStatus} 
              />
            ))
          )}
        </tbody>
      </table>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-700 dark:text-gray-400">
            Viser <span className="font-medium">{areas.length > 0 ? (currentPage - 1) * 10 + 1 : 0}</span> til <span className="font-medium">{Math.min(currentPage * 10, totalAreas)}</span> av <span className="font-medium">{totalAreas}</span> områder
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded-md ${
                currentPage === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700'
                  : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              } border border-gray-300 dark:border-gray-600`}
            >
              Forrige
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`px-3 py-1 rounded-md ${
                  currentPage === page
                    ? 'bg-blue-600 text-white dark:bg-blue-700'
                    : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                } border border-gray-300 dark:border-gray-600`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded-md ${
                currentPage === totalPages
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700'
                  : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              } border border-gray-300 dark:border-gray-600`}
            >
              Neste
            </button>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}

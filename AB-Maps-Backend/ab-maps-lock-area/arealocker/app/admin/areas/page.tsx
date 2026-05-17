'use client';

import { useState } from 'react';
import useAreas from '@/hooks/useAreas';
import AreaTable from '@/components/AreaTable';
import ThemeToggle from '@/components/ThemeToggle';
import AreaToggleView from '@/components/AreaToggleView';
import AreaMap from '@/components/AreaMap';
import AreaModal from '@/components/AreaModal';
import { ViewMode, Area } from '@/types';

export default function AreasAdminPage() {
  const {
    paginatedAreas,
    filteredAreas,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    totalPages,
    toggleAreaStatus,
    viewMode,
    setViewMode,
    fylkeFilter,
    setFylkeFilter,
    bydelFilter,
    setBydelFilter,
    selectedFylke,
    setSelectedFylke,
    getAreasByFylke,
    getAreaCountsByFylke,
    getAreaCountsByBydel,
    isToggling
  } = useAreas();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  
  const handleToggleClick = (area: Area) => {
    setSelectedArea(area);
    setIsModalOpen(true);
  };
  
  // Handle toggle from list view - directly call toggleAreaStatus
  const handleListToggleClick = async (area: Area): Promise<Area> => {
    // Directly call the toggle function from useAreas
    return toggleAreaStatus(area);
  };
  
  const handleCountyClick = (fylke: string) => {
    setSelectedFylke(fylke);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            AB MAPS Admin
          </h1>
          <ThemeToggle />
        </div>
      </header>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Administrer områder
          </h2>
        </div>
        
        {/* View Toggle */}
        <div className="mb-6">
          <AreaToggleView 
            currentView={viewMode} 
            onViewChange={setViewMode} 
          />
        </div>

        {error && (
          <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-200 dark:text-red-800" role="alert">
            <span className="font-medium">Feil:</span> {error}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          {viewMode === 'list' ? (
            <AreaTable
              areas={paginatedAreas}
              loading={loading}
              onToggleStatus={handleListToggleClick}
              currentPage={currentPage}
              totalPages={totalPages}
              totalAreas={filteredAreas?.length || 0}
              onPageChange={setCurrentPage}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              fylkeFilter={fylkeFilter}
              onFylkeFilterChange={setFylkeFilter}
              bydelFilter={bydelFilter}
              onBydelFilterChange={setBydelFilter}
            />
          ) : (
            <div className="p-4">
              <AreaMap 
                areas={paginatedAreas} 
                onCountyClick={handleCountyClick} 
                areaCounts={getAreaCountsByFylke()} 
                open={filteredAreas.filter(area => area.status === 'open').length}
                closed={filteredAreas.filter(area => area.status === 'closed').length}
                total={filteredAreas.length}
                bydelFilter={bydelFilter}
                onBydelFilterChange={setBydelFilter}
                onToggleStatus={handleListToggleClick}
              />
            </div>
          )}
        </div>

        {/* Area Modal for Map View */}
        {viewMode === 'map' && selectedFylke && (
          <AreaModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            fylke={selectedFylke}
            areas={getAreasByFylke(selectedFylke)}
            onToggleStatus={toggleAreaStatus}
            isToggling={isToggling}
          />
        )}
        
        {/* Area Modal for List View */}
        {viewMode === 'list' && selectedArea && (
          <AreaModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            fylke={selectedArea.fylke}
            areas={[selectedArea]}
            onToggleStatus={toggleAreaStatus}
            isToggling={isToggling}
          />
        )}
      </div>
    </div>
  );
}

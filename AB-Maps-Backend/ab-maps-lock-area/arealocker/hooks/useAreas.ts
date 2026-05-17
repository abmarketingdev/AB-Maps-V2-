import { useState, useEffect, useCallback } from 'react';
import { Area, ViewMode, norwegianCounties } from '@/types';
import toast from 'react-hot-toast';

export default function useAreas() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [filteredAreas, setFilteredAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [fylkeFilter, setFylkeFilter] = useState<string>('all');
  const [bydelFilter, setBydelFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedFylke, setSelectedFylke] = useState<string | null>(null);

  const itemsPerPage = 10;

  // Fetch areas
  useEffect(() => {
    const fetchAreas = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/areas');
        
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
        
        const data = await response.json();
        setAreas(data);
        setFilteredAreas(data);
        setError(null);
      } catch (err) {
        setError('Failed to fetch areas. Please try again later.');
        console.error('Error fetching areas:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAreas();
  }, []);

  // Filter areas based on search query, fylke filter, and bydel filter
  useEffect(() => {
    let filtered = areas;
    
    // Filter by search query
    if (searchQuery.trim() !== '') {
      const lowercasedQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(area => 
        area.campaign_name.toLowerCase().includes(lowercasedQuery)
      );
    }
    
    // Filter by fylke
    if (fylkeFilter !== 'all') {
      filtered = filtered.filter(area => area.fylke === fylkeFilter);
      
      // Filter by bydel (only if a specific fylke is selected)
      if (bydelFilter) {
        filtered = filtered.filter(area => area.bydel === bydelFilter);
      }
    }
    
    setFilteredAreas(filtered);
    setCurrentPage(1); // Reset to first page when filtering
  }, [searchQuery, fylkeFilter, bydelFilter, areas]);

  // Get areas by fylke for map view
  const getAreasByFylke = useCallback((fylke: string) => {
    return areas.filter(area => area.fylke === fylke);
  }, [areas]);

  // Get counts of open/closed areas by fylke
  const getAreaCountsByFylke = useCallback(() => {
    const counts: Record<string, { open: number; closed: number; total: number }> = {};
    
    norwegianCounties.forEach(county => {
      counts[county] = { open: 0, closed: 0, total: 0 };
    });
    
    areas.forEach(area => {
      if (counts[area.fylke]) {
        counts[area.fylke].total += 1;
        if (area.status === 'open') {
          counts[area.fylke].open += 1;
        } else {
          counts[area.fylke].closed += 1;
        }
      }
    });
    
    return counts;
  }, [areas]);
  
  // Get counts of open/closed areas by bydel for a specific fylke
  const getAreaCountsByBydel = useCallback((fylke: string) => {
    // Filter areas by the selected fylke
    const fylkeAreas = areas.filter(area => area.fylke === fylke);
    
    // Create a map of bydel to counts
    const counts: Record<string, { open: number; closed: number; total: number }> = {};
    
    // Initialize counts for each unique bydel
    const uniqueBydeler = Array.from(new Set(fylkeAreas.map(area => area.bydel).filter(Boolean)));
    uniqueBydeler.forEach(bydel => {
      if (bydel) counts[bydel] = { open: 0, closed: 0, total: 0 };
    });
    
    // Count areas by bydel
    fylkeAreas.forEach(area => {
      if (area.bydel && counts[area.bydel]) {
        counts[area.bydel].total += 1;
        if (area.status === 'open') {
          counts[area.bydel].open += 1;
        } else {
          counts[area.bydel].closed += 1;
        }
      }
    });
    
    return counts;
  }, [areas]);

  // Handle area status toggle - returns a Promise for optimistic UI updates
  const toggleAreaStatus = useCallback(async (area: Area): Promise<Area> => {
    if (!area || !area.id) {
      console.error('Invalid area object:', area);
      toast.error('Kunne ikke endre status: Ugyldig område');
      throw new Error('Invalid area object');
    }
    
    setIsToggling(true);
    try {
      console.log('Toggling status for area:', area.id);
      
      // Include the current status in the request to ensure proper toggling
      const newStatus = area.status === 'open' ? 'closed' : 'open';
      console.log(`Toggling area ${area.id} from ${area.status} to ${newStatus}`);
      
      const response = await fetch(`/api/areas/${area.id}/toggle_status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Send the area ID and desired new status in the body
        body: JSON.stringify({ 
          id: area.id,
          newStatus: newStatus
        })
      });

      // Log the response status for debugging
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Error: ${response.status} - ${errorText}`);
      }

      const updatedArea = await response.json();
      console.log('Updated area:', updatedArea);
      
      // Create a new copy of the areas array with the updated area
      const updatedAreas = areas.map(a => 
        a.id === updatedArea.id ? {...updatedArea} : a
      );
      
      // Update both areas and filteredAreas state
      setAreas(updatedAreas);
      
      // Also update filtered areas to ensure UI reflects changes immediately
      setFilteredAreas(prevFilteredAreas => 
        prevFilteredAreas.map(a => a.id === updatedArea.id ? {...updatedArea} : a)
      );

      toast.success(`Områdestatus endret til ${updatedArea.status === 'open' ? 'åpen' : 'lukket'}`);
      setIsModalOpen(false);
      setSelectedArea(null);
      
      // Return the updated area for chaining
      return updatedArea;
    } catch (err) {
      toast.error('Kunne ikke endre områdestatus. Vennligst prøv igjen.');
      console.error('Error toggling area status:', err);
      setIsToggling(false);
      // Re-throw the error so the component can handle it
      throw err;
    }
  }, [areas]);

  const paginatedAreas = filteredAreas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredAreas.length / itemsPerPage);

  return {
    areas,
    filteredAreas,
    paginatedAreas,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    fylkeFilter,
    setFylkeFilter,
    bydelFilter,
    setBydelFilter,
    currentPage,
    setCurrentPage,
    totalPages,
    isModalOpen,
    setIsModalOpen,
    selectedArea,
    setSelectedArea,
    toggleAreaStatus,
    isToggling,
    viewMode,
    setViewMode,
    selectedFylke,
    setSelectedFylke,
    getAreasByFylke,
    getAreaCountsByFylke,
    getAreaCountsByBydel
  };
}

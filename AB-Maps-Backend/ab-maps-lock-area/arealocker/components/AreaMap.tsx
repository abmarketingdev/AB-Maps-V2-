'use client';

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Area } from '@/types';
import MapLegend from './MapLegend';
import AreaInfoPanel from './AreaInfoPanel';

// Import the type from LeafletComponents
import type { LeafletComponentsProps } from './LeafletComponents';

// Dynamically import the Leaflet component
// Using a more stable approach for Next.js to avoid ChunkLoadError during hot reloading
const MapComponents = dynamic<LeafletComponentsProps>(
  () => import('./LeafletComponents').then(mod => mod.default),
  { 
    ssr: false, 
    loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Laster kart...</p>
      </div>
    </div>
  )}
);

interface AreaMapProps {
  areas: Area[];
  onCountyClick: (fylke: string) => void;
  areaCounts: Record<string, { open: number; closed: number; total: number }>;
  open?: number;
  closed?: number;
  total?: number;
  bydelFilter?: string;
  onBydelFilterChange?: (bydel: string) => void;
  onToggleStatus?: (area: Area) => Promise<Area>;
}

// Simplified GeoJSON of Norwegian counties
// In a real application, you would load this from a GeoJSON file
const norwegianCountiesGeoJSON = {
  type: 'FeatureCollection',
  features: [
    // This is a simplified placeholder - in a real app, you would use actual GeoJSON data
    {
      type: 'Feature',
      properties: { name: 'Oslo' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[10.6, 59.9], [10.8, 59.9], [10.8, 59.8], [10.6, 59.8], [10.6, 59.9]]]
      }
    },
    // Oslo districts (bydeler) - simplified for demonstration
    {
      type: 'Feature',
      properties: { name: 'Oslo', bydel: 'Grünerløkka' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[10.75, 59.92], [10.78, 59.92], [10.78, 59.91], [10.75, 59.91], [10.75, 59.92]]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Oslo', bydel: 'Gamle Oslo' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[10.76, 59.91], [10.79, 59.91], [10.79, 59.90], [10.76, 59.90], [10.76, 59.91]]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Oslo', bydel: 'Sagene' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[10.74, 59.93], [10.77, 59.93], [10.77, 59.92], [10.74, 59.92], [10.74, 59.93]]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Oslo', bydel: 'Nordstrand' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[10.78, 59.89], [10.81, 59.89], [10.81, 59.88], [10.78, 59.88], [10.78, 59.89]]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Viken' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[10.2, 59.7], [11.2, 59.7], [11.2, 60.1], [10.2, 60.1], [10.2, 59.7]]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Innlandet' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[10.0, 60.5], [12.0, 60.5], [12.0, 62.0], [10.0, 62.0], [10.0, 60.5]]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Vestfold og Telemark' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[9.5, 59.0], [10.5, 59.0], [10.5, 59.6], [9.5, 59.6], [9.5, 59.0]]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Agder' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[7.5, 58.0], [9.0, 58.0], [9.0, 59.0], [7.5, 59.0], [7.5, 58.0]]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Rogaland' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[5.5, 58.3], [7.0, 58.3], [7.0, 59.2], [5.5, 59.2], [5.5, 58.3]]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Vestland' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[4.5, 59.5], [7.5, 59.5], [7.5, 61.5], [4.5, 61.5], [4.5, 59.5]]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Møre og Romsdal' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[5.0, 62.0], [8.0, 62.0], [8.0, 63.0], [5.0, 63.0], [5.0, 62.0]]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Trøndelag' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[10.0, 63.0], [13.0, 63.0], [13.0, 65.0], [10.0, 65.0], [10.0, 63.0]]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Nordland' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[11.0, 65.0], [15.0, 65.0], [15.0, 68.0], [11.0, 68.0], [11.0, 65.0]]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Troms og Finnmark' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[16.0, 68.0], [30.0, 68.0], [30.0, 71.0], [16.0, 71.0], [16.0, 68.0]]]
      }
    }
  ]
};

export default function AreaMap({ 
  areas, 
  onCountyClick, 
  areaCounts, 
  open = 0, 
  closed = 0, 
  total = 0, 
  bydelFilter = '', 
  onBydelFilterChange = () => {},
  onToggleStatus = async (area) => area // Default no-op implementation
}: AreaMapProps) {
  const [isClient, setIsClient] = useState(false);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  
  // Generate area polygons GeoJSON from the areas prop
  const areaPolygonsGeoJSON = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: areas.map(area => ({
        type: 'Feature',
        properties: {
          id: area.id,
          name: area.campaign_name,
          fylke: area.fylke,
          bydel: area.bydel || '',
          status: area.status,
          created_by: area.created_by,
          created_at: area.created_at,
          isArea: true // Flag to identify this as an area polygon
        },
        // Generate a simple polygon based on the area's id
        // In a real app, you would use actual GeoJSON coordinates for each area
        geometry: {
          type: 'Polygon',
          coordinates: [
            // Generate a simple square polygon with slight variations based on the area id
            // This is just for demonstration - in a real app you'd use actual coordinates
            [
              [10.5 + (parseInt(area.id) * 0.05) % 0.5, 59.8 + (parseInt(area.id) * 0.03) % 0.3],
              [10.55 + (parseInt(area.id) * 0.05) % 0.5, 59.8 + (parseInt(area.id) * 0.03) % 0.3],
              [10.55 + (parseInt(area.id) * 0.05) % 0.5, 59.85 + (parseInt(area.id) * 0.03) % 0.3],
              [10.5 + (parseInt(area.id) * 0.05) % 0.5, 59.85 + (parseInt(area.id) * 0.03) % 0.3],
              [10.5 + (parseInt(area.id) * 0.05) % 0.5, 59.8 + (parseInt(area.id) * 0.03) % 0.3]
            ]
          ]
        }
      }))
    };
  }, [areas]);

  // Only render on client-side
  useEffect(() => {
    // Fix for Leaflet icon issues in Next.js
    if (typeof window !== 'undefined') {
      // Add Leaflet CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      
      const L = require('leaflet');
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/marker-icon-2x.png',
        iconUrl: '/marker-icon.png',
        shadowUrl: '/marker-shadow.png',
      });
      
      setIsClient(true);
    }
  }, []);
  // Style function for the GeoJSON layer
  const getStyle = (feature: any) => {
    // If this is an area polygon (from our areas data)
    if (feature.properties.isArea) {
      const status = feature.properties.status;
      const isSelected = selectedArea && selectedArea.id === feature.properties.id;
      
      return {
        fillColor: status === 'open' ? '#4ade80' : '#f87171', // Green for open, red for closed
        weight: isSelected ? 3 : 1,
        opacity: 1,
        color: isSelected ? 'yellow' : 'white',
        dashArray: isSelected ? '0' : '3',
        fillOpacity: isSelected ? 0.8 : 0.6
      };
    }
    
    // For county/bydel features
    const countyName = feature.properties.name;
    const countyData = areaCounts[countyName] || { open: 0, closed: 0, total: 0 };
    
    // Calculate color based on ratio of open areas
    const openRatio = countyData.total > 0 ? countyData.open / countyData.total : 0;
    
    // Color scale from red (all closed) to green (all open)
    const hue = openRatio * 120; // 0 = red, 120 = green
    
    // If the feature has a bydel property and we're viewing Oslo
    if (feature.properties.bydel && countyName === 'Oslo') {
      // Generate a unique color for each bydel
      // We'll use a hash function to generate a consistent hue for each bydel name
      const bydelName = feature.properties.bydel;
      const bydelHash = bydelName.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
      const bydelHue = bydelHash % 360; // Ensure hue is between 0-359
      
      // Highlight the selected bydel with a brighter color
      const isSelected = bydelFilter === bydelName;
      
      return {
        fillColor: `hsl(${bydelHue}, ${isSelected ? 90 : 70}%, ${isSelected ? 60 : 50}%)`,
        weight: isSelected ? 2 : 1,
        opacity: 0.7, // Make county/bydel polygons more transparent
        color: isSelected ? 'yellow' : 'white',
        dashArray: isSelected ? '0' : '3',
        fillOpacity: isSelected ? 0.5 : 0.3 // Lower opacity for administrative boundaries
      };
    }
    
    return {
      fillColor: countyData.total > 0 ? `hsl(${hue}, 70%, 50%)` : '#ccc',
      weight: 1,
      opacity: 0.7,
      color: 'white',
      dashArray: '3',
      fillOpacity: 0.3 // Lower opacity for administrative boundaries
    };
  };

  // Handle click on a county, bydel, or area
  const onEachFeature = (feature: any, layer: any) => {
    // If this is an area polygon (from our areas data)
    if (feature.properties.isArea) {
      const areaId = feature.properties.id;
      const areaName = feature.properties.name;
      const areaStatus = feature.properties.status;
      
      layer.on({
        click: () => {
          // Find the corresponding area object
          const clickedArea = areas.find(a => a.id === areaId);
          if (clickedArea) {
            setSelectedArea(clickedArea);
          }
        }
      });
      
      // Add tooltip showing area name and status
      layer.bindTooltip(
        `<strong>${areaName}</strong><br/>
        Status: ${areaStatus === 'open' ? 'Åpen' : 'Lukket'}<br/>
        Klikk for å se detaljer`,
        { sticky: true }
      );
      
      return;
    }
    
    // For county/bydel features
    const countyName = feature.properties.name;
    const bydelName = feature.properties.bydel;
    const countyData = areaCounts[countyName] || { open: 0, closed: 0, total: 0 };
    
    layer.on({
      click: () => {
        // Close any open area info panel when clicking on administrative boundaries
        setSelectedArea(null);
        
        if (bydelName) {
          // If this is a bydel feature, filter by bydel
          onBydelFilterChange(bydelName);
        } else {
          // Otherwise, it's a county feature
          onCountyClick(countyName);
        }
      }
    });
    
    // Add tooltip showing county/bydel name and stats
    if (bydelName) {
      // For bydel features, show bydel name and stats
      layer.bindTooltip(
        `<strong>${countyName} - ${bydelName}</strong><br/>
        Klikk for å filtrere på denne bydelen`,
        { sticky: true }
      );
    } else {
      // For county features, show county name and stats
      layer.bindTooltip(
        `<strong>${countyName}</strong><br/>
        Åpne: ${countyData.open}<br/>
        Lukket: ${countyData.closed}<br/>
        Totalt: ${countyData.total}<br/>
        Klikk for å filtrere på dette fylket`,
        { sticky: true }
      );
    }
  };

  return (
    <div className="h-[600px] w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 relative">
      {isClient ? (
        <>
          <MapComponents
            center={[62.5, 10]}
            zoom={5}
            norwegianCountiesGeoJSON={norwegianCountiesGeoJSON}
            areaPolygonsGeoJSON={areaPolygonsGeoJSON}
            getStyle={getStyle}
            onEachFeature={onEachFeature}
          />
          <MapLegend open={open} closed={closed} total={total} />
          {selectedArea && (
            <AreaInfoPanel 
              area={selectedArea} 
              onClose={() => setSelectedArea(null)}
              onToggleStatus={onToggleStatus}
            />
          )}
        </>
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Laster kart...</p>
          </div>
        </div>
      )}
    </div>
  );
}

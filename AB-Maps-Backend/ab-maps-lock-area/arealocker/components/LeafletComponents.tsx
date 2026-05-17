'use client';

import React from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';

export interface LeafletComponentsProps {
  center: LatLngExpression;
  zoom: number;
  style?: React.CSSProperties;
  zoomControl?: boolean;
  norwegianCountiesGeoJSON: any;
  areaPolygonsGeoJSON?: any;
  getStyle: (feature: any) => any;
  onEachFeature: (feature: any, layer: any) => void;
  attribution?: string;
  url?: string;
  children?: React.ReactNode;
}

// Create a simple functional component
function LeafletComponentsFC(props: LeafletComponentsProps) {
  const { 
    center, 
    zoom, 
    style = { height: '100%', width: '100%' }, 
    zoomControl = true, 
    norwegianCountiesGeoJSON, 
    areaPolygonsGeoJSON, 
    getStyle, 
    onEachFeature,
    attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    children
  } = props;
  
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={style}
      zoomControl={zoomControl}
    >
      <TileLayer
        attribution={attribution}
        url={url}
      />
      {/* Administrative boundaries layer (counties and districts) */}
      {norwegianCountiesGeoJSON && (
        <GeoJSON
          key="counties"
          data={norwegianCountiesGeoJSON}
          style={getStyle}
          onEachFeature={onEachFeature}
        />
      )}
      {/* Area polygons layer (campaign areas) */}
      {areaPolygonsGeoJSON && (
        <GeoJSON
          key="areas"
          data={areaPolygonsGeoJSON}
          style={getStyle}
          onEachFeature={onEachFeature}
        />
      )}
      {children}
    </MapContainer>
  );
}

// Export as default only to avoid confusion
export default LeafletComponentsFC;

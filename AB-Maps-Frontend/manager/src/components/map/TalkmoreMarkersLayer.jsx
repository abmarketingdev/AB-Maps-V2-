import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { createLeafletDivIcon } from '../../utils/mapIcons';

/**
 * Single blue palette for all Talkmore / enrichment map pins (no carrier-based colors).
 * @see prompts_org/employee_maps/TALKMORE_ENRICHMENT_MARKERS_BLUE_ONLY.md
 */
const ENRICHMENT_PIN = {
  fill: '#2563EB',
  fillHover: '#1D4ED8',
  fillSelected: '#1E40AF',
  stroke: '#ffffff',
  scale: 0.8,
  scaleHover: 0.9,
  scaleSelected: 0.92,
};

function makeEnrichmentPinIcon(Lib, { fill, scale }) {
  return createLeafletDivIcon(Lib, {
    type: 'pin',
    fillColor: fill,
    strokeColor: ENRICHMENT_PIN.stroke,
    scale,
  });
}

/**
 * TalkmoreMarkersLayer Component
 *
 * Displays enriched addresses as small pin markers on the map.
 * All pins use the same blue; hover/click use darker blue variants only.
 * Appears above areas layer.
 *
 * @param {Array} features - Array of GeoJSON features (enriched addresses)
 * @param {boolean} enabled - Whether to display markers (default: true)
 */
export default function TalkmoreMarkersLayer({ features = [], enabled = true }) {
  const map = useMap();
  const markersRef = useRef(new Map());
  const layerGroupRef = useRef(null);
  const selectedFeatureIdRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    const PANE_NAME = 'talkmore-markers-pane';
    if (!map.getPane(PANE_NAME)) {
      const pane = map.createPane(PANE_NAME);
      pane.style.zIndex = 590;
    }

    layerGroupRef.current = L.layerGroup().addTo(map);

    return () => {
      if (layerGroupRef.current) {
        layerGroupRef.current.clearLayers();
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current = null;
      }
      markersRef.current.clear();
      selectedFeatureIdRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    if (!map || !layerGroupRef.current) return;

    const layerGroup = layerGroupRef.current;
    const existingMarkers = markersRef.current;

    if (!enabled) {
      existingMarkers.forEach((marker) => {
        marker.off('mouseover');
        marker.off('mouseout');
        marker.off('click');
        layerGroup.removeLayer(marker);
      });
      existingMarkers.clear();
      selectedFeatureIdRef.current = null;
      return;
    }

    const newFeatureIds = new Set();

    features.forEach((feature) => {
      if (!feature || !feature.geometry || !feature.properties) return;

      const featureId =
        feature.id ||
        feature.properties.id ||
        `${feature.geometry.coordinates[0]}-${feature.geometry.coordinates[1]}`;
      newFeatureIds.add(featureId);

      if (existingMarkers.has(featureId)) return;

      const [lon, lat] = feature.geometry.coordinates;
      if (typeof lat !== 'number' || typeof lon !== 'number') {
        console.warn('[TalkmoreMarkersLayer] Invalid coordinates:', feature.geometry.coordinates);
        return;
      }

      const iconDefault = makeEnrichmentPinIcon(L, {
        fill: ENRICHMENT_PIN.fill,
        scale: ENRICHMENT_PIN.scale,
      });
      const iconHover = makeEnrichmentPinIcon(L, {
        fill: ENRICHMENT_PIN.fillHover,
        scale: ENRICHMENT_PIN.scaleHover,
      });
      const iconSelected = makeEnrichmentPinIcon(L, {
        fill: ENRICHMENT_PIN.fillSelected,
        scale: ENRICHMENT_PIN.scaleSelected,
      });

      const marker = L.marker([lat, lon], {
        icon: iconDefault,
        pane: 'talkmore-markers-pane',
        interactive: true,
        keyboard: false,
        bubblingMouseEvents: false,
        zIndexOffset: 0,
      });

      const applyVisualState = () => {
        const sel = selectedFeatureIdRef.current;
        if (sel === featureId) {
          marker.setIcon(iconSelected);
        } else {
          marker.setIcon(iconDefault);
        }
      };

      const onMouseOver = () => {
        if (selectedFeatureIdRef.current === featureId) {
          marker.setIcon(iconSelected);
        } else {
          marker.setIcon(iconHover);
        }
      };

      const onMouseOut = () => {
        applyVisualState();
      };

      const onClick = (e) => {
        L.DomEvent.stopPropagation(e);
        const prev = selectedFeatureIdRef.current;
        if (prev === featureId) {
          selectedFeatureIdRef.current = null;
          marker.setIcon(iconDefault);
          return;
        }
        if (prev && existingMarkers.has(prev)) {
          const prevMarker = existingMarkers.get(prev);
          prevMarker.setIcon(
            makeEnrichmentPinIcon(L, {
              fill: ENRICHMENT_PIN.fill,
              scale: ENRICHMENT_PIN.scale,
            })
          );
        }
        selectedFeatureIdRef.current = featureId;
        marker.setIcon(iconSelected);
      };

      marker.on('mouseover', onMouseOver);
      marker.on('mouseout', onMouseOut);
      marker.on('click', onClick);

      marker.addTo(layerGroup);
      existingMarkers.set(featureId, marker);
    });

    existingMarkers.forEach((marker, featureId) => {
      if (!newFeatureIds.has(featureId)) {
        marker.off('mouseover');
        marker.off('mouseout');
        marker.off('click');
        if (selectedFeatureIdRef.current === featureId) {
          selectedFeatureIdRef.current = null;
        }
        layerGroup.removeLayer(marker);
        existingMarkers.delete(featureId);
      }
    });
  }, [map, features, enabled]);

  return null;
}

"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import {
  TILE_SOURCES,
  ALL_LAYERS,
  INTERACTIVE_LAYERS,
  SOURCE_LAYERS,
} from "@/lib/demographics/mapStyles";
import { DEFAULT_METRIC, getChoroplethExpression } from "@/lib/demographics/metrics";
import type { MetricDefinition, TooltipData, SelectedGrunnkrets } from "@/lib/demographics/types";
import { MetricSelector } from "./MetricSelector";
import { Legend } from "./Legend";
import { Tooltip } from "./Tooltip";
import { GrunnkretsStatsDrawer } from "./GrunnkretsStatsDrawer";
import { AreaCartButton } from "./AreaCartButton";
import { LockedAreasPanel } from "./LockedAreasPanel";
import { useAreasLockStore, type AreaInfo } from "@/stores/areasLockStore";

/**
 * AdminDemographicsMap Component
 * 
 * Phase 1: Core map setup with vector tiles
 * Phase 2: Choropleth styling with metric selector
 * Phase 3: Legend component
 * Phase 4: Hover tooltip
 * Phase 5: Click selection & highlight
 * Phase 6: Stats drawer with charts
 * Phase 7+: Area locking - multi-layer click selection
 * 
 * - Initializes MapLibre map once using useRef
 * - Adds three vector tile sources (fylke, kommune, grunnkrets)
 * - Adds fill and outline layers with zoom constraints
 * - Colors grunnkrets polygons based on selected metric
 * - Shows tooltip on hover with debounced updates
 * - Highlights selected grunnkrets on click
 * - Opens drawer with detailed stats and charts on click
 * - Supports clicking fylke/kommune/grunnkrets for area locking
 * - Map instance stored in ref, never recreated on state changes
 */
export function AdminDemographicsMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapInitialized = useRef(false);
  const mapLoaded = useRef(false);
  const tooltipRafRef = useRef<number | null>(null);

  // State for selected metric (Phase 2)
  const [selectedMetric, setSelectedMetric] = useState<MetricDefinition>(DEFAULT_METRIC);

  // State for tooltip (Phase 4)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // State for grunnkrets stats drawer (Phase 5/6)
  const [selectedGrunnkrets, setSelectedGrunnkrets] = useState<SelectedGrunnkrets | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // True when MapLibre can't create a WebGL context (some mobile browsers / webviews) — we
  // show a friendly fallback instead of letting the thrown error white-screen the page.
  const [mapError, setMapError] = useState(false);

  // Area locking store
  const {
    initializeCampaign,
    fetchLockedAreas,
    toggleSelection,
    selectedAreaKeys,
    lockedAreaKeys,
    campaignId,
  } = useAreasLockStore();

  /**
   * Initialize map and add sources/layers
   * Runs once on mount
   */
  const initializeMap = useCallback(() => {
    if (!mapContainer.current || mapInitialized.current) return;

    // Create MapLibre map instance. Guard against WebGL init failure (unsupported/disabled
    // GPU on some mobile browsers/webviews) so the whole page doesn't crash.
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            // OpenStreetMap base tiles
            "osm-tiles": {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [
            {
              id: "osm-tiles",
              type: "raster",
              source: "osm-tiles",
            },
          ],
        },
        center: [10.7522, 59.9139], // Oslo, Norway
        zoom: 4, // Start at fylke level
        minZoom: 4,
        maxZoom: 18,
      });
    } catch (err) {
      console.error("[AdminDemographicsMap] Failed to initialize map (WebGL?):", err);
      setMapError(true);
      return;
    }

    // Store map reference
    mapRef.current = map;
    mapInitialized.current = true;

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    // Wait for map style to load before adding sources and layers
    map.on("load", () => {
      console.log("[AdminDemographicsMap] Map loaded, adding sources and layers");

      // Add vector tile sources
      Object.entries(TILE_SOURCES).forEach(([sourceId, sourceSpec]) => {
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, sourceSpec);
          console.log(`[AdminDemographicsMap] Added source: ${sourceId}`);
        }
      });

      // Add all layers in order
      ALL_LAYERS.forEach((layer) => {
        if (!map.getLayer(layer.id)) {
          map.addLayer(layer);
          console.log(`[AdminDemographicsMap] Added layer: ${layer.id}`);
        }
      });

      // Set cursor to pointer on interactive layers
      Object.values(INTERACTIVE_LAYERS).forEach((layerId) => {
        map.on("mouseenter", layerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
        });
      });

      // Apply initial choropleth styling to grunnkrets layer
      const initialExpression = getChoroplethExpression(DEFAULT_METRIC);
      map.setPaintProperty('grunnkrets-fill', 'fill-color', initialExpression as maplibregl.ExpressionSpecification);
      console.log("[AdminDemographicsMap] Applied initial choropleth for:", DEFAULT_METRIC.label);

      // Mark map as loaded
      mapLoaded.current = true;

      console.log("[AdminDemographicsMap] All sources and layers added successfully");
    });

    // Phase 4: Hover tooltip handlers for grunnkrets
    map.on("mousemove", INTERACTIVE_LAYERS.grunnkrets, (e) => {
      // Cancel any pending RAF
      if (tooltipRafRef.current) {
        cancelAnimationFrame(tooltipRafRef.current);
      }

      // Debounce with requestAnimationFrame
      tooltipRafRef.current = requestAnimationFrame(() => {
        const features = e.features;
        if (!features || features.length === 0) {
          setTooltip(null);
          return;
        }

        const feature = features[0];
        const props = feature.properties || {};

        // Extract only primitive values, no geometry
        setTooltip({
          x: e.point.x,
          y: e.point.y,
          name: props.name || "Unknown",
          code: props.code || "",
          population_total: props.population_total ?? null,
          donor_pool_stable: props.donor_pool_stable ?? null,
          pop_67_plus: props.pop_67_plus ?? null,
          share_30_66: props.share_30_66 ?? null,
          mean_age_est_total: props.mean_age_est_total ?? null,
        });
      });
    });

    map.on("mouseleave", INTERACTIVE_LAYERS.grunnkrets, () => {
      if (tooltipRafRef.current) {
        cancelAnimationFrame(tooltipRafRef.current);
      }
      setTooltip(null);
    });

    // ==================== Area Click Handlers (Phase 7+: Locking) ====================
    
    /**
     * Helper to extract area info from feature properties
     * Constructs area_key from level and code if not directly available
     */
    const extractAreaInfo = (
      props: Record<string, unknown>,
      level: 'fylke' | 'kommune' | 'grunnkrets'
    ): AreaInfo | null => {
      // Try to get area_key directly, or construct it
      const code = props.code as string || props.area_code as string;
      if (!code) return null;

      const area_key = props.area_key as string || `${level}:${code}`;
      const name = (props.name || props.area_name || props.gk_name || 'Ukjent') as string;

      return { area_key, name, code, level };
    };

    // Fylke click handler - toggle selection only
    map.on("click", INTERACTIVE_LAYERS.fylke, (e) => {
      const features = e.features;
      if (!features || features.length === 0) return;

      const feature = features[0];
      const props = feature.properties || {};
      const areaInfo = extractAreaInfo(props, 'fylke');

      if (!areaInfo) return;

      console.log("[AdminDemographicsMap] Clicked fylke:", areaInfo);

      // Get store state directly to avoid stale closure
      const store = useAreasLockStore.getState();
      store.toggleSelection(areaInfo);
    });

    // Kommune click handler - toggle selection only
    map.on("click", INTERACTIVE_LAYERS.kommune, (e) => {
      const features = e.features;
      if (!features || features.length === 0) return;

      const feature = features[0];
      const props = feature.properties || {};
      const areaInfo = extractAreaInfo(props, 'kommune');

      if (!areaInfo) return;

      console.log("[AdminDemographicsMap] Clicked kommune:", areaInfo);

      // Get store state directly to avoid stale closure
      const store = useAreasLockStore.getState();
      store.toggleSelection(areaInfo);
    });

    // Grunnkrets click handler - toggle selection AND open stats drawer
    map.on("click", INTERACTIVE_LAYERS.grunnkrets, (e) => {
      const features = e.features;
      if (!features || features.length === 0) return;

      const feature = features[0];
      const props = feature.properties || {};
      const code = props.code as string;
      const name = (props.name || "Unknown") as string;

      if (!code) return;

      console.log("[AdminDemographicsMap] Clicked grunnkrets:", { code, name });

      // Toggle selection in store
      const areaInfo = extractAreaInfo(props, 'grunnkrets');
      if (areaInfo) {
        const store = useAreasLockStore.getState();
        store.toggleSelection(areaInfo);
      }

      // Also open stats drawer (existing behavior)
      setSelectedGrunnkrets({ code, name });
      setDrawerOpen(true);

      // Update highlight layer filter for stats view
      map.setFilter("grunnkrets-selected", ["==", ["get", "code"], code]);
    });

    // Click on empty area - close drawer only (selection stays)
    map.on("click", (e) => {
      // Check if click was on any interactive layer
      const allInteractiveLayers = Object.values(INTERACTIVE_LAYERS);
      const features = map.queryRenderedFeatures(e.point, {
        layers: allInteractiveLayers,
      });

      if (features.length === 0) {
        // Clicked on empty area, close drawer but keep selections
        setSelectedGrunnkrets(null);
        setDrawerOpen(false);
        map.setFilter("grunnkrets-selected", ["==", ["get", "code"], ""]);
      }
    });

    // Handle map errors
    map.on("error", (e) => {
      console.error("[AdminDemographicsMap] Map error:", e.error);
    });

  }, []);

  /**
   * Initialize map on mount, cleanup on unmount
   */
  useEffect(() => {
    initializeMap();

    // Cleanup on unmount
    return () => {
      // Cancel any pending RAF
      if (tooltipRafRef.current) {
        cancelAnimationFrame(tooltipRafRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        mapInitialized.current = false;
        mapLoaded.current = false;
      }
    };
  }, [initializeMap]);

  /**
   * Initialize campaign and fetch locked areas on mount
   */
  useEffect(() => {
    initializeCampaign();
  }, [initializeCampaign]);

  /**
   * Fetch locked areas when campaign ID is set
   */
  useEffect(() => {
    if (campaignId) {
      fetchLockedAreas();
    }
  }, [campaignId, fetchLockedAreas]);

  /**
   * Update choropleth when selected metric changes
   * Uses setPaintProperty for instant recoloring without layer recreation
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded.current) return;

    // Generate new choropleth expression for the selected metric
    const expression = getChoroplethExpression(selectedMetric);
    
    // Update the grunnkrets fill layer paint property
    map.setPaintProperty('grunnkrets-fill', 'fill-color', expression as maplibregl.ExpressionSpecification);
    
    console.log("[AdminDemographicsMap] Updated choropleth for:", selectedMetric.label);
  }, [selectedMetric]);

  /**
   * Update map highlight filters when selection or locked areas change
   * Uses setFilter for instant updates without layer recreation
   * Debounced with requestAnimationFrame for performance
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded.current) return;

    // Use RAF for smooth debouncing
    const rafId = requestAnimationFrame(() => {
      // Helper to extract codes from area_keys for a specific level
      // area_key format: "level:code" e.g., "kommune:0301"
      const extractCodes = (keys: Set<string>, level: string): string[] => {
        const codes: string[] = [];
        keys.forEach(key => {
          if (key.startsWith(`${level}:`)) {
            codes.push(key.split(':')[1]);
          }
        });
        return codes;
      };

      // Get codes for each level, excluding locked from selected
      const levels = ['fylke', 'kommune', 'grunnkrets'] as const;
      
      levels.forEach(level => {
        const selectedCodes = extractCodes(selectedAreaKeys, level);
        const lockedCodes = extractCodes(lockedAreaKeys, level);
        
        // For selected, exclude any that are locked (locked wins)
        const lockedSet = new Set(lockedCodes);
        const selectedOnlyCodes = selectedCodes.filter(code => !lockedSet.has(code));

        // Update selected layer filter
        const selectedLayerId = level === 'grunnkrets' 
          ? 'grunnkrets-lock-selected-outline' 
          : `${level}-selected-outline`;
        
        if (map.getLayer(selectedLayerId)) {
          map.setFilter(selectedLayerId, 
            ['in', ['get', 'code'], ['literal', selectedOnlyCodes]]
          );
        }

        // Update locked layer filter
        const lockedLayerId = `${level}-locked-outline`;
        if (map.getLayer(lockedLayerId)) {
          map.setFilter(lockedLayerId, 
            ['in', ['get', 'code'], ['literal', lockedCodes]]
          );
        }
      });

      console.log("[AdminDemographicsMap] Updated highlight filters - Selected:", selectedAreaKeys.size, "Locked:", lockedAreaKeys.size);
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [selectedAreaKeys, lockedAreaKeys]);

  /**
   * Handle metric selection change
   */
  const handleMetricChange = useCallback((metric: MetricDefinition) => {
    setSelectedMetric(metric);
  }, []);

  /**
   * Handle drawer close (Phase 5)
   */
  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedGrunnkrets(null);
    
    // Clear selection highlight
    const map = mapRef.current;
    if (map && mapLoaded.current) {
      map.setFilter("grunnkrets-selected", ["==", ["get", "code"], ""]);
    }
  }, []);

  return (
    <div className="relative h-full w-full">
      {/* Map container */}
      <div ref={mapContainer} className="h-full w-full" />

      {/* WebGL/init failure fallback — keeps the page usable instead of white-screening */}
      {mapError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-ab-base px-4 sm:px-6 text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ab-fg-4"><path d="M12 21s-7-5.686-7-11a7 7 0 0 1 14 0c0 5.314-7 11-7 11Z"/><path d="m3 3 18 18"/></svg>
          <p className="text-sm font-medium text-ab-fg-2">Kartet kunne ikke lastes på denne enheten</p>
          <p className="max-w-xs text-xs text-ab-fg-3">Nettleseren eller enheten støtter ikke WebGL-kart. Prøv en annen nettleser, eller åpne siden på en datamaskin.</p>
          <button
            onClick={() => { mapInitialized.current = false; setMapError(false); initializeMap(); }}
            className="mt-1 inline-flex items-center gap-2 rounded-lg border border-ab-line bg-ab-elevated px-3.5 py-2 text-sm text-ab-fg-2 hover:bg-ab-hover transition-colors"
          >
            Prøv igjen
          </button>
        </div>
      )}

      {/* Metric selector dropdown (Phase 2) */}
      <MetricSelector
        selectedMetric={selectedMetric}
        onMetricChange={handleMetricChange}
      />

      {/* Area locking cart button (Phase 4) */}
      <AreaCartButton />

      {/* Legend (Phase 3) */}
      <Legend metric={selectedMetric} />

      {/* Hover tooltip (Phase 4) */}
      <Tooltip data={tooltip} />

      {/* Stats drawer (Phase 6) */}
      <GrunnkretsStatsDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        code={selectedGrunnkrets?.code ?? null}
        name={selectedGrunnkrets?.name ?? ""}
      />

      {/* Locked areas panel (Phase 5) */}
      <LockedAreasPanel />
      
      {/* Zoom level indicator (dev helper) */}
      <div className="absolute bottom-4 left-4 bg-ab-active text-ab-fg px-3 py-1 rounded-md shadow-sm text-sm font-medium">
        <ZoomIndicator mapRef={mapRef} />
      </div>
    </div>
  );
}

/**
 * Zoom level indicator component
 * Shows current zoom level and which layer is visible
 */
function ZoomIndicator({ mapRef }: { mapRef: React.RefObject<maplibregl.Map | null> }) {
  const [zoom, setZoom] = useState(4);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleZoom = () => {
      setZoom(Math.round(map.getZoom() * 10) / 10);
    };

    // Initial zoom
    handleZoom();

    // Listen for zoom changes
    map.on("zoom", handleZoom);

    return () => {
      map.off("zoom", handleZoom);
    };
  }, [mapRef]);

  // Determine which layer is visible based on zoom
  const getVisibleLayer = () => {
    if (zoom < 7) return "Fylke";
    if (zoom < 11) return "Kommune";
    return "Grunnkrets";
  };

  return (
    <span>
      Zoom: {zoom.toFixed(1)} | Layer: {getVisibleLayer()}
    </span>
  );
}

export default AdminDemographicsMap;


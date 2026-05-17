"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MlMap, Popup as MlPopup, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import { useTheme } from "next-themes";
import { MapPinOff, Plus, Minus, Home } from "lucide-react";
import { Area } from "@/services/areaService";

// Inline bbox helper for Polygon / MultiPolygon — avoids pulling in @turf
// just for one function. Returns [minX, minY, maxX, maxY].
function geomBbox(g: Geometry | Feature): [number, number, number, number] | null {
  const geom: Geometry | undefined =
    (g as Feature).type === "Feature" ? (g as Feature).geometry : (g as Geometry);
  if (!geom) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const walk = (coords: any): void => {
    if (typeof coords[0] === "number") {
      const [x, y] = coords as Position;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      return;
    }
    for (const c of coords) walk(c);
  };
  if ("coordinates" in geom) walk((geom as any).coordinates);
  if (!isFinite(minX)) return null;
  return [minX, minY, maxX, maxY];
}

// OSM raster fallback. Production should swap in MapTiler/Mapbox via NEXT_PUBLIC_*.
// TODO: read NEXT_PUBLIC_MAP_STYLE / NEXT_PUBLIC_MAPTILER_KEY if/when provisioned.
const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const NORWAY_CENTER: [number, number] = [14.5, 64.5];
const NORWAY_ZOOM = 4;

interface AreaWithAssignees extends Area {
  __assignees?: { id: string; name: string }[];
}

interface AreasMapProps {
  areas: AreaWithAssignees[];
  selectedAreaId: string | null;
  hoveredAreaId: string | null;
  highlightedAreaIds: string[] | null; // when workload-dock employee click filters
  onAreaSelect: (areaId: string | null) => void;
  onAreaHover: (areaId: string | null) => void;
  onOpenEdit: (area: Area) => void;
}

function featureFromArea(a: AreaWithAssignees): Feature | null {
  if (!a.polygon_geometry) return null;
  const geom = a.polygon_geometry;
  // Accept either bare geometry { type, coordinates } or wrapped feature
  const geometry =
    geom?.type === "Feature" ? geom.geometry : geom?.type ? geom : null;
  if (!geometry) return null;
  return {
    type: "Feature",
    id: a.id,
    geometry,
    properties: {
      id: a.id,
      name: a.name,
      color: a.color || "#3b82f6",
    },
  };
}

export function AreasMap({
  areas,
  selectedAreaId,
  hoveredAreaId,
  highlightedAreaIds,
  onAreaSelect,
  onAreaHover,
  onOpenEdit,
}: AreasMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRef = useRef<MlPopup | null>(null);
  const [ready, setReady] = useState(false);
  const [errored, setErrored] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // FeatureCollection memoised — feature props are static; selection lives in feature state.
  const fc: FeatureCollection = useMemo(() => {
    const features = areas
      .map(featureFromArea)
      .filter((f): f is Feature => Boolean(f));
    return { type: "FeatureCollection", features };
  }, [areas]);

  // Lookup for popup content
  const areaById = useMemo(() => {
    const m = new Map<string, AreaWithAssignees>();
    areas.forEach((a) => m.set(a.id, a));
    return m;
  }, [areas]);

  // --- Init map ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: OSM_STYLE,
        center: NORWAY_CENTER,
        zoom: NORWAY_ZOOM,
        attributionControl: { compact: true },
      });
      mapRef.current = map;

      map.on("load", () => {
        // Add source + layers
        map.addSource("areas", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          promoteId: "id",
        });

        map.addLayer({
          id: "areas-fill",
          type: "fill",
          source: "areas",
          paint: {
            "fill-color": ["coalesce", ["get", "color"], "#3b82f6"],
            "fill-opacity": [
              "case",
              ["boolean", ["feature-state", "dimmed"], false],
              0.18,
              ["boolean", ["feature-state", "selected"], false],
              0.78,
              ["boolean", ["feature-state", "hovered"], false],
              0.62,
              0.45,
            ],
          },
        });

        map.addLayer({
          id: "areas-line",
          type: "line",
          source: "areas",
          paint: {
            "line-color": ["coalesce", ["get", "color"], "#3b82f6"],
            "line-width": [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              2.4,
              ["boolean", ["feature-state", "hovered"], false],
              1.8,
              1.2,
            ],
            "line-opacity": 0.95,
          },
        });

        // Interactions
        map.on("mousemove", "areas-fill", (e) => {
          map.getCanvas().style.cursor = "pointer";
          const id = (e.features?.[0]?.id ?? null) as string | null;
          if (id) onAreaHover(id);
        });
        map.on("mouseleave", "areas-fill", () => {
          map.getCanvas().style.cursor = "";
          onAreaHover(null);
        });
        map.on("click", "areas-fill", (e) => {
          const id = (e.features?.[0]?.id ?? null) as string | null;
          if (id) onAreaSelect(id);
        });
        map.on("dblclick", (e) => {
          const feats = map.queryRenderedFeatures(e.point, {
            layers: ["areas-fill"],
          });
          if (feats.length === 0) {
            onAreaSelect(null);
          }
        });

        // Initial flyTo for the dramatic mount
        map.flyTo({
          center: NORWAY_CENTER,
          zoom: NORWAY_ZOOM,
          duration: 1200,
          essential: true,
        });

        setReady(true);
      });

      map.on("error", (e) => {
        // Don't crash for missing tiles — only for catastrophic init failures
        if ((e as any)?.error?.message?.includes("Failed to fetch")) return;
        console.warn("Map error", e);
      });

      // Belt-and-suspenders resize: layout completion can race the constructor
      // when this map is inside a CSS grid cell stretched by sibling content.
      const ro = new ResizeObserver(() => map.resize());
      ro.observe(containerRef.current);
      const t0 = window.setTimeout(() => map.resize(), 0);
      const t1 = window.setTimeout(() => map.resize(), 200);

      // Cleanup attached to this map's lifecycle
      (map as any).__cleanupAux = () => {
        ro.disconnect();
        window.clearTimeout(t0);
        window.clearTimeout(t1);
      };
    } catch (e) {
      console.error("MapLibre init failed", e);
      setErrored(true);
    }

    return () => {
      const m = mapRef.current as any;
      if (m && typeof m.__cleanupAux === "function") m.__cleanupAux();
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Push features when areas change ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource("areas") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(fc);

    // After filter change, fitBounds to union if multiple, fly to one if single.
    if (fc.features.length === 0) return;
    try {
      if (fc.features.length === 1) {
        const b = geomBbox(fc.features[0]);
        if (!b) return;
        map.fitBounds(b as [number, number, number, number], {
          padding: 80,
          duration: 800,
          essential: true,
        });
      } else {
        // Build bbox across all features
        let mx = Infinity, my = Infinity, MX = -Infinity, MY = -Infinity;
        for (const feat of fc.features) {
          const bb = geomBbox(feat);
          if (!bb) continue;
          if (bb[0] < mx) mx = bb[0];
          if (bb[1] < my) my = bb[1];
          if (bb[2] > MX) MX = bb[2];
          if (bb[3] > MY) MY = bb[3];
        }
        if (!isFinite(mx)) return;
        const b: [number, number, number, number] = [mx, my, MX, MY];
        // Don't auto-fit on every render — only when the set length changes
        // (we approximate by checking distance from current view)
        map.fitBounds(b as [number, number, number, number], {
          padding: 60,
          duration: 800,
          essential: true,
          maxZoom: 11,
        });
      }
    } catch {
      // bbox can fail for degenerate features — silently ignore
    }
  }, [fc, ready]);

  // --- Selected / hovered / dimmed feature states ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    // Clear all state, then set what's active.
    fc.features.forEach((f) => {
      const id = f.id as string;
      map.setFeatureState(
        { source: "areas", id },
        {
          selected: id === selectedAreaId,
          hovered: id === hoveredAreaId && id !== selectedAreaId,
          dimmed:
            Array.isArray(highlightedAreaIds) &&
            highlightedAreaIds.length > 0 &&
            !highlightedAreaIds.includes(id),
        },
      );
    });
  }, [fc, selectedAreaId, hoveredAreaId, highlightedAreaIds, ready]);

  // --- Fly to selected ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !selectedAreaId) return;
    const f = fc.features.find((x) => x.id === selectedAreaId);
    if (!f) return;
    try {
      const b = geomBbox(f);
      if (!b) return;
      map.fitBounds(b, {
        padding: 80,
        duration: 1000,
        essential: true,
        maxZoom: 13,
      });
    } catch {
      /* ignore */
    }
  }, [selectedAreaId, fc, ready]);

  // --- Selected-area Popup ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    popupRef.current?.remove();
    popupRef.current = null;
    if (!selectedAreaId) return;
    const feat = fc.features.find((x) => x.id === selectedAreaId);
    const area = areaById.get(selectedAreaId);
    if (!feat || !area) return;
    let center: [number, number] | null = null;
    try {
      const b = geomBbox(feat);
      if (!b) return;
      center = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
    } catch {
      return;
    }
    const assignees = area.__assignees ?? [];
    const houseLabel =
      area.house_count != null
        ? new Intl.NumberFormat("nb-NO").format(area.house_count)
        : "—";
    const node = document.createElement("div");
    node.className =
      "ab-area-popup text-[12px] text-ab-fg leading-tight min-w-[200px]";
    node.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="text-[13px] font-semibold text-ab-fg truncate">${escapeHtml(area.name)}</div>
          <div class="text-[11px] text-ab-fg-3 uppercase tracking-wider mt-0.5">${escapeHtml(area.campaign?.name ?? "Uten kampanje")}</div>
        </div>
        <button data-pop-close aria-label="Lukk" class="h-6 w-6 -mr-1 -mt-1 inline-flex items-center justify-center rounded-md text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover">✕</button>
      </div>
      <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        <div>
          <div class="text-[10px] uppercase tracking-wider text-ab-fg-3 font-semibold">Dører</div>
          <div class="mono text-[12px] text-ab-fg tabular">${houseLabel}</div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wider text-ab-fg-3 font-semibold">Tildelt</div>
          <div class="mono text-[12px] text-ab-fg tabular">${assignees.length}</div>
        </div>
      </div>
      <button data-pop-open class="mt-3 text-[12px] font-medium text-ab-accent hover:text-ab-accent-2">Åpne detaljer →</button>
    `;
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14,
      className: "ab-popup",
    })
      .setLngLat(center)
      .setDOMContent(node)
      .addTo(map);
    popupRef.current = popup;
    node
      .querySelector<HTMLButtonElement>("[data-pop-close]")
      ?.addEventListener("click", () => onAreaSelect(null));
    node
      .querySelector<HTMLButtonElement>("[data-pop-open]")
      ?.addEventListener("click", () => onOpenEdit(area));
  }, [selectedAreaId, fc, areaById, ready, onAreaSelect, onOpenEdit]);

  // --- Zoom control handlers ---
  const handleZoomIn = () => mapRef.current?.zoomIn({ duration: 200 });
  const handleZoomOut = () => mapRef.current?.zoomOut({ duration: 200 });
  const handleHome = () => {
    const map = mapRef.current;
    if (!map) return;
    onAreaSelect(null);
    map.flyTo({
      center: NORWAY_CENTER,
      zoom: NORWAY_ZOOM,
      duration: 1000,
      essential: true,
    });
  };

  // Build legend list (unique campaign colors visible in current set)
  const legend = useMemo(() => {
    const seen = new Map<string, { color: string; label: string }>();
    areas.forEach((a) => {
      const key = a.color || "#3b82f6";
      if (!seen.has(key)) {
        seen.set(key, { color: key, label: a.campaign?.name || "Uten kampanje" });
      }
    });
    return Array.from(seen.values()).slice(0, 6);
  }, [areas]);

  if (errored) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-ab-base text-center px-6">
        <MapPinOff className="h-14 w-14 text-ab-fg-3 mb-3" strokeWidth={1.25} />
        <div className="text-[16px] font-medium text-ab-fg">Kart kunne ikke lastes</div>
        <button
          type="button"
          onClick={() => location.reload()}
          className="ab-btn mt-4"
        >
          Prøv igjen
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-ab-subtle">
      <div
        ref={containerRef}
        className="h-full w-full"
        style={
          isDark && ready
            ? {
                filter:
                  "invert(0.92) hue-rotate(180deg) saturate(0.6) brightness(0.95) contrast(0.9)",
              }
            : undefined
        }
      />
      {/* Loading shimmer until first paint */}
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-ab-subtle pointer-events-none">
          <div className="text-[11px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold animate-pulse">
            Laster kart…
          </div>
        </div>
      )}

      {/* Legend overlay */}
      {legend.length > 0 && (
        <div
          className="absolute top-3 right-3 bg-ab-elevated/90 backdrop-blur-md border border-ab-line rounded-lg p-3 max-w-[200px] shadow-sm hidden xl:block"
          style={{ zIndex: 1 }}
        >
          <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold mb-2">
            FARGE = KAMPANJE
          </div>
          <ul className="space-y-1.5">
            {legend.map((l) => (
              <li key={l.color} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-3 w-3 rounded-sm border border-black/10 dark:border-white/10 shrink-0"
                  style={{ background: l.color }}
                />
                <span className="text-[12px] text-ab-fg-2 truncate">
                  {l.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Zoom controls */}
      <div
        className="absolute bottom-4 right-3 flex flex-col gap-1 bg-ab-elevated/90 backdrop-blur-md border border-ab-line rounded-md p-1 shadow-sm"
        style={{ zIndex: 1 }}
      >
        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Zoom inn"
          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-ab-fg-2 hover:bg-ab-hover hover:text-ab-fg transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Zoom ut"
          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-ab-fg-2 hover:bg-ab-hover hover:text-ab-fg transition-colors"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleHome}
          aria-label="Nullstill kart"
          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-ab-fg-2 hover:bg-ab-hover hover:text-ab-fg transition-colors"
        >
          <Home className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

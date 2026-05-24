"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MlMap, Popup as MlPopup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Geometry, Feature, Position } from "geojson";
import { MapPinOff, Plus, Minus, Home } from "lucide-react";
import { Area, getCampaignExtent } from "@/services/areaService";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// Keyless dark vector basemap (CARTO dark-matter) — fast, crisp, and already
// dark, so no CSS invert filter is needed. Override via NEXT_PUBLIC_MAP_STYLE.
const MAP_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE ||
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// MVT source/layer ids. The source-layer name MUST match the backend exactly.
const SRC = "campaign-areas";
const SRC_LAYER = "campaign_areas";
const FILL = "ca-fill";
const OUTLINE = "ca-outline";

const tileUrl = (campaignId: string) =>
  `${API_BASE}/tiles/campaign-areas/{z}/{x}/{y}.mvt?campaign=${campaignId}`;

// Inline bbox helper for Polygon / MultiPolygon — used to fit/centre on areas
// selected from the list (which carry polygon_geometry). Returns [minX,minY,maxX,maxY].
function geomBbox(g: Geometry | Feature): [number, number, number, number] | null {
  const geom: Geometry | undefined =
    (g as Feature).type === "Feature" ? (g as Feature).geometry : (g as Geometry);
  if (!geom) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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

const NORWAY_CENTER: [number, number] = [14.5, 64.5];
const NORWAY_ZOOM = 4;

// Dark-glass popup chrome (MapLibre wraps our node in .maplibregl-popup-content).
// Injected once so the popup matches the dashboard instead of MapLibre's white box.
const POPUP_CSS = `
.maplibregl-popup.ab-popup { z-index: 5; }
.maplibregl-popup.ab-popup .maplibregl-popup-content {
  background: transparent; padding: 0; border-radius: 16px; box-shadow: none;
}
.maplibregl-popup.ab-popup .maplibregl-popup-close-button { display: none; }
.maplibregl-popup.ab-popup .maplibregl-popup-tip {
  border-top-color: #0d1730; border-bottom-color: #0d1730;
  border-left-color: #0d1730; border-right-color: #0d1730; opacity: 0.97;
}
.ab-area-pop { animation: abPopIn .16s cubic-bezier(.23,1,.32,1); }
@keyframes abPopIn { from { opacity: 0; transform: translateY(4px) scale(.97); } to { opacity: 1; transform: none; } }
`;
function ensurePopupStyles() {
  if (typeof document === "undefined" || document.getElementById("ab-popup-css")) return;
  const s = document.createElement("style");
  s.id = "ab-popup-css";
  s.textContent = POPUP_CSS;
  document.head.appendChild(s);
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  open:     { label: "Åpen",     color: "#34d399" },
  active:   { label: "Aktiv",    color: "#34d399" },
  closed:   { label: "Lukket",   color: "#f87171" },
  inactive: { label: "Inaktiv",  color: "#94a3b8" },
};
// Frame Norway by default and stop the user panning off to the rest of the world.
const NORWAY_BOUNDS: [[number, number], [number, number]] = [[4.0, 57.5], [31.5, 71.5]];
const MAX_BOUNDS: [[number, number], [number, number]] = [[-10, 53], [45, 74]];

interface AreaWithAssignees extends Area {
  __assignees?: { id: string; name: string }[];
}

// Optional heat overlay: color each area polygon by a metric value (ja-rate or
// doors), joined to the MVT features by area_id.
export interface HeatOverlay {
  metric: "ja_rate" | "doors";
  values: Record<string, number>; // area_id → value
  max: number;
}

// Blue→teal→green ramp (t in 0..1).
export function heatColor(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  const stops: [number, [number, number, number]][] = [
    [0, [37, 99, 235]],    // blue
    [0.5, [14, 165, 165]], // teal
    [1, [16, 185, 129]],   // green
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) if (c >= stops[i][0] && c <= stops[i + 1][0]) { lo = stops[i]; hi = stops[i + 1]; break; }
  const span = hi[0] - lo[0] || 1;
  const k = (c - lo[0]) / span;
  const rgb = lo[1].map((v, i) => Math.round(v + (hi[1][i] - v) * k));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

interface AreasMapProps {
  campaignId: string | null;
  areas: AreaWithAssignees[];
  selectedAreaId: string | null;
  hoveredAreaId: string | null;
  highlightedAreaIds: string[] | null; // when workload-dock employee click filters
  onAreaSelect: (areaId: string | null) => void;
  onAreaHover: (areaId: string | null) => void;
  onOpenEdit: (area: Area) => void;
  heat?: HeatOverlay | null;
}

// Info captured off a clicked/visible tile feature, for the popup.
interface TileFeatureInfo {
  name?: string;
  status?: string;
  doors: number;
  center: [number, number];
}

export function AreasMap({
  campaignId,
  areas,
  selectedAreaId,
  hoveredAreaId,
  highlightedAreaIds,
  onAreaSelect,
  onAreaHover,
  onOpenEdit,
  heat,
}: AreasMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRef = useRef<MlPopup | null>(null);
  const [ready, setReady] = useState(false);
  const [errored, setErrored] = useState(false);

  // Ids whose feature-state we've set, so we can clear them before re-applying.
  const touchedRef = useRef<Set<string>>(new Set());
  const heatTouchedRef = useRef<Set<string>>(new Set());
  // Tile-feature info captured on click, keyed by area_id (for the popup).
  const tileInfoRef = useRef<Map<string, TileFeatureInfo>>(new Map());

  // Lookup for popup enrichment (campaign name, assignees) from the list data.
  const areaById = useMemo(() => {
    const m = new Map<string, AreaWithAssignees>();
    areas.forEach((a) => m.set(a.id, a));
    return m;
  }, [areas]);

  // --- Init map (once) ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: NORWAY_CENTER,
        zoom: NORWAY_ZOOM,
        minZoom: 3.2,
        maxBounds: MAX_BOUNDS,
        attributionControl: { compact: true },
      });
      mapRef.current = map;

      map.on("load", () => {
        // Frame Norway (the container aspect can otherwise reveal half the globe).
        map.fitBounds(NORWAY_BOUNDS, { padding: 20, animate: false });
        // Click on empty space deselects (guard: layer may not exist yet).
        map.on("dblclick", (e) => {
          if (!map.getLayer(FILL)) return;
          const feats = map.queryRenderedFeatures(e.point, { layers: [FILL] });
          if (feats.length === 0) onAreaSelect(null);
        });
        setReady(true);
      });

      map.on("error", (e) => {
        if ((e as any)?.error?.message?.includes("Failed to fetch")) return;
        console.warn("Map error", e);
      });

      const ro = new ResizeObserver(() => map.resize());
      ro.observe(containerRef.current);
      const t0 = window.setTimeout(() => map.resize(), 0);
      const t1 = window.setTimeout(() => map.resize(), 200);
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

  // --- Vector source + layers, keyed on the selected campaign ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // No campaign selected → tear down any existing layers/source.
    if (!campaignId) {
      popupRef.current?.remove();
      popupRef.current = null;
      if (map.getLayer(FILL)) map.removeLayer(FILL);
      if (map.getLayer(OUTLINE)) map.removeLayer(OUTLINE);
      if (map.getSource(SRC)) map.removeSource(SRC);
      touchedRef.current.clear();
      tileInfoRef.current.clear();
      map.fitBounds(NORWAY_BOUNDS, { padding: 20, animate: false });
      return;
    }

    const url = tileUrl(campaignId);
    const existing = map.getSource(SRC) as maplibregl.VectorTileSource | undefined;
    if (existing) {
      // Campaign changed — just point the existing source at the new tiles.
      existing.setTiles([url]);
      touchedRef.current.clear();
      tileInfoRef.current.clear();
    } else {
      map.addSource(SRC, {
        type: "vector",
        tiles: [url],
        minzoom: 4,
        maxzoom: 14, // overzoom past 14 so it still renders at street level
        promoteId: { [SRC_LAYER]: "area_id" }, // enables feature-state by area_id
      });
      map.addLayer({
        id: FILL,
        type: "fill",
        source: SRC,
        "source-layer": SRC_LAYER,
        paint: {
          // Heat color (feature-state) wins when a heat overlay is active,
          // else the campaign color.
          "fill-color": ["coalesce", ["feature-state", "heatColor"], ["coalesce", ["get", "color"], "#3b82f6"]],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false], 0.78,
            ["boolean", ["feature-state", "hovered"], false], 0.62,
            0.5,
          ],
        },
      });
      map.addLayer({
        id: OUTLINE,
        type: "line",
        source: SRC,
        "source-layer": SRC_LAYER,
        paint: {
          "line-color": ["coalesce", ["get", "color"], "#3b82f6"],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false], 2.4,
            ["boolean", ["feature-state", "hovered"], false], 1.8,
            1.2,
          ],
          "line-opacity": 0.95,
        },
      });

      // Hover → pointer + hover callback (handlers persist for the source's life).
      map.on("mousemove", FILL, (e) => {
        map.getCanvas().style.cursor = "pointer";
        const id = e.features?.[0]?.id;
        if (id != null) onAreaHover(String(id));
      });
      map.on("mouseleave", FILL, () => {
        map.getCanvas().style.cursor = "";
        onAreaHover(null);
      });
      // Click → zoom into the area using its baked-in bbox (no network request).
      map.on("click", FILL, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties || {};
        const id = f.id != null ? String(f.id) : String(p.area_id ?? "");
        if (!id) return;
        const minx = Number(p.bbox_minx), miny = Number(p.bbox_miny);
        const maxx = Number(p.bbox_maxx), maxy = Number(p.bbox_maxy);
        if ([minx, miny, maxx, maxy].every((n) => Number.isFinite(n))) {
          map.fitBounds([[minx, miny], [maxx, maxy]], { padding: 60, essential: true, duration: 500, maxZoom: 16 });
          tileInfoRef.current.set(id, {
            name: p.name,
            status: p.status,
            doors: (Number(p.house_count) || 0) + (Number(p.apartment_count) || 0),
            center: [(minx + maxx) / 2, (miny + maxy) / 2],
          });
        }
        onAreaSelect(id);
      });
    }

    // Fit to the full campaign extent (all areas visible at once). Defensively
    // clamp to Norway's bounds so a stray out-of-country polygon (bad data row)
    // can't blow the bbox up to the whole globe.
    let cancelled = false;
    getCampaignExtent(campaignId)
      .then((bbox) => {
        if (cancelled || !bbox) return;
        const minx = Math.max(bbox[0], NORWAY_BOUNDS[0][0]);
        const miny = Math.max(bbox[1], NORWAY_BOUNDS[0][1]);
        const maxx = Math.min(bbox[2], NORWAY_BOUNDS[1][0]);
        const maxy = Math.min(bbox[3], NORWAY_BOUNDS[1][1]);
        // If clamping leaves a valid box, use it; otherwise frame Norway.
        if (maxx > minx && maxy > miny) {
          map.fitBounds([[minx, miny], [maxx, maxy]], { padding: 40, essential: true, animate: false });
        } else {
          map.fitBounds(NORWAY_BOUNDS, { padding: 20, animate: false });
        }
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [campaignId, ready, onAreaSelect, onAreaHover]);

  // --- Selected / hovered / highlighted feature states ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !campaignId || !map.getSource(SRC)) return;

    // Clear previously touched ids.
    touchedRef.current.forEach((id) => {
      map.setFeatureState({ source: SRC, sourceLayer: SRC_LAYER, id }, { selected: false, hovered: false });
    });
    const touched = new Set<string>();
    const setState = (id: string, st: { selected?: boolean; hovered?: boolean }) => {
      map.setFeatureState({ source: SRC, sourceLayer: SRC_LAYER, id }, st);
      touched.add(id);
    };

    if (selectedAreaId) setState(selectedAreaId, { selected: true });
    if (hoveredAreaId && hoveredAreaId !== selectedAreaId) setState(hoveredAreaId, { hovered: true });
    // Workload-dock highlight: pop the highlighted areas (reuse 'selected' style).
    if (Array.isArray(highlightedAreaIds)) {
      highlightedAreaIds.forEach((id) => { if (id !== selectedAreaId) setState(id, { selected: true }); });
    }
    touchedRef.current = touched;
  }, [selectedAreaId, hoveredAreaId, highlightedAreaIds, ready, campaignId]);

  // --- Heat overlay: color each area by metric value (joined on area_id) ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !campaignId || !map.getSource(SRC)) return;
    // Clear previous heat colors.
    heatTouchedRef.current.forEach((id) => {
      map.setFeatureState({ source: SRC, sourceLayer: SRC_LAYER, id }, { heatColor: null });
    });
    const touched = new Set<string>();
    if (heat && heat.max > 0) {
      Object.entries(heat.values).forEach(([id, value]) => {
        map.setFeatureState({ source: SRC, sourceLayer: SRC_LAYER, id }, { heatColor: heatColor(value / heat.max) });
        touched.add(id);
      });
    }
    heatTouchedRef.current = touched;
  }, [heat, ready, campaignId]);

  // --- Fit to selection coming from the list ---
  // Preference: clicked tile bbox (map clicks already fit) → row.bbox → polygon_geometry (legacy).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !selectedAreaId) return;
    if (tileInfoRef.current.has(selectedAreaId)) return; // map click already fit
    const area = areaById.get(selectedAreaId);
    if (!area) return;
    let b: [number, number, number, number] | null = null;
    if (Array.isArray(area.bbox) && area.bbox.length === 4) {
      b = area.bbox as [number, number, number, number];
    } else if (area.polygon_geometry) {
      try { b = geomBbox(area.polygon_geometry as Geometry); } catch { /* ignore */ }
    }
    if (b) map.fitBounds(b, { padding: 80, essential: true, maxZoom: 16, duration: 500 });
  }, [selectedAreaId, areaById, ready]);

  // --- Selected-area popup ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    popupRef.current?.remove();
    popupRef.current = null;
    if (!selectedAreaId) return;

    const area = areaById.get(selectedAreaId);
    const tile = tileInfoRef.current.get(selectedAreaId);

    // Resolve a centre: clicked tile bbox → row.bbox → list geometry.
    let center: [number, number] | null = tile?.center ?? null;
    if (!center && Array.isArray(area?.bbox) && area!.bbox!.length === 4) {
      const b = area!.bbox as [number, number, number, number];
      center = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
    }
    if (!center && area?.polygon_geometry) {
      try {
        const b = geomBbox(area.polygon_geometry as Geometry);
        if (b) center = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
      } catch { /* ignore */ }
    }
    if (!center) return;

    ensurePopupStyles();

    const name = area?.name ?? tile?.name ?? "Område";
    const campaignName = area?.campaign?.name ?? "";
    const color = area?.color || "#3b82f6";
    const doors = tile?.doors ?? area?.doors ?? area?.house_count ?? null;
    const doorsLabel = doors != null ? new Intl.NumberFormat("nb-NO").format(doors) : "—";
    const assignees = area?.__assignees ?? [];
    const statusKey = String(area?.status ?? tile?.status ?? "").toLowerCase();
    const status = STATUS_META[statusKey];

    const node = document.createElement("div");
    node.className = "ab-area-pop";
    node.style.cssText =
      "width:264px;border-radius:16px;overflow:hidden;color:#e7ecf5;" +
      "background:linear-gradient(180deg,rgba(17,26,48,0.97),rgba(11,18,35,0.97));" +
      "border:1px solid rgba(255,255,255,0.10);" +
      "box-shadow:0 20px 60px -12px rgba(0,0,0,0.7),inset 0 1px 0 rgba(255,255,255,0.05);" +
      "-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);font-family:inherit;";
    node.innerHTML = `
      <div style="position:relative;padding:14px 14px 12px;">
        <div style="position:absolute;inset:0 0 auto 0;height:3px;background:linear-gradient(90deg,${color},transparent 80%);"></div>
        <button data-pop-close aria-label="Lukk" style="position:absolute;top:10px;right:10px;height:26px;width:26px;display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:8px;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.55);cursor:pointer;font-size:14px;line-height:1;transition:all .12s;">✕</button>
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;">
          <span style="height:9px;width:9px;border-radius:3px;background:${color};box-shadow:0 0 8px ${color};flex:none;"></span>
          <span style="font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,0.4);">${escapeHtml(campaignName || "Uten kampanje")}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;padding-right:26px;">
          <div style="font-size:15px;font-weight:700;color:#fff;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(name)}</div>
          ${status ? `<span style="flex:none;display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;background:${status.color}22;color:${status.color};"><span style="height:5px;width:5px;border-radius:999px;background:${status.color};"></span>${status.label}</span>` : ""}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 14px 12px;">
        <div style="border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);padding:9px 10px;">
          <div style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:3px;">Dører</div>
          <div style="font-size:17px;font-weight:700;color:#fff;font-variant-numeric:tabular-nums;">${doorsLabel}</div>
        </div>
        <div style="border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);padding:9px 10px;">
          <div style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:3px;">Tildelt</div>
          <div style="font-size:17px;font-weight:700;color:#fff;font-variant-numeric:tabular-nums;">${assignees.length}</div>
        </div>
      </div>
      ${area ? `<button data-pop-open style="display:flex;align-items:center;justify-content:center;gap:6px;width:calc(100% - 28px);margin:0 14px 14px;padding:9px 0;border:none;border-radius:10px;background:${color}1f;color:${color};font-size:12px;font-weight:600;cursor:pointer;transition:background .12s;">Åpne detaljer <span style="font-size:13px;">→</span></button>` : ""}
    `;
    const closeBtn = node.querySelector<HTMLButtonElement>("[data-pop-close]");
    if (closeBtn) {
      closeBtn.addEventListener("mouseenter", () => { closeBtn.style.background = "rgba(255,255,255,0.12)"; closeBtn.style.color = "#fff"; });
      closeBtn.addEventListener("mouseleave", () => { closeBtn.style.background = "rgba(255,255,255,0.06)"; closeBtn.style.color = "rgba(255,255,255,0.55)"; });
    }
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
    node.querySelector<HTMLButtonElement>("[data-pop-close]")?.addEventListener("click", () => onAreaSelect(null));
    if (area) node.querySelector<HTMLButtonElement>("[data-pop-open]")?.addEventListener("click", () => onOpenEdit(area));
  }, [selectedAreaId, areaById, ready, onAreaSelect, onOpenEdit]);

  // --- Zoom control handlers ---
  const handleZoomIn = () => mapRef.current?.zoomIn({ duration: 200 });
  const handleZoomOut = () => mapRef.current?.zoomOut({ duration: 200 });
  const handleHome = () => {
    const map = mapRef.current;
    if (!map) return;
    onAreaSelect(null);
    map.fitBounds(NORWAY_BOUNDS, { padding: 20, duration: 600, essential: true });
  };

  if (errored) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-ab-base text-center px-6">
        <MapPinOff className="h-14 w-14 text-ab-fg-3 mb-3" strokeWidth={1.25} />
        <div className="text-[16px] font-medium text-ab-fg">Kart kunne ikke lastes</div>
        <button type="button" onClick={() => location.reload()} className="ab-btn mt-4">
          Prøv igjen
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-ab-subtle">
      <div ref={containerRef} className="h-full w-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-ab-subtle pointer-events-none">
          <div className="text-[11px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold animate-pulse">
            Laster kart…
          </div>
        </div>
      )}

      {/* Empty state when no campaign is selected */}
      {ready && !campaignId && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-ab-subtle/80 backdrop-blur-[1px] pointer-events-none text-center px-6">
          <MapPinOff className="h-10 w-10 text-ab-fg-3 mb-3" strokeWidth={1.25} />
          <div className="text-sm font-medium text-ab-fg">Velg en kampanje</div>
          <div className="text-[12px] text-ab-fg-3 mt-1">Områdene vises på kartet når du velger en kampanje.</div>
        </div>
      )}

      <div className="absolute bottom-4 right-3 flex flex-col gap-1 bg-ab-elevated/90 backdrop-blur-md border border-ab-line rounded-md p-1 shadow-sm" style={{ zIndex: 1 }}>
        <button type="button" onClick={handleZoomIn} aria-label="Zoom inn" className="h-8 w-8 inline-flex items-center justify-center rounded-md text-ab-fg-2 hover:bg-ab-hover hover:text-ab-fg transition-colors">
          <Plus className="h-4 w-4" />
        </button>
        <button type="button" onClick={handleZoomOut} aria-label="Zoom ut" className="h-8 w-8 inline-flex items-center justify-center rounded-md text-ab-fg-2 hover:bg-ab-hover hover:text-ab-fg transition-colors">
          <Minus className="h-4 w-4" />
        </button>
        <button type="button" onClick={handleHome} aria-label="Nullstill kart" className="h-8 w-8 inline-flex items-center justify-center rounded-md text-ab-fg-2 hover:bg-ab-hover hover:text-ab-fg transition-colors">
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

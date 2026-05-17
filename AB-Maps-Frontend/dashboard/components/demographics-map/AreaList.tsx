"use client";

import { X, Unlock, MapPin, Building2, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { AreaInfo, LockedAreaInfo } from "@/stores/areasLockStore";

/**
 * Level icons and labels
 */
const LEVEL_CONFIG = {
  fylke: {
    label: "Fylke",
    labelPlural: "Fylker",
    icon: Map,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  kommune: {
    label: "Kommune",
    labelPlural: "Kommuner",
    icon: Building2,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  grunnkrets: {
    label: "Grunnkrets",
    labelPlural: "Grunnkretser",
    icon: MapPin,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
} as const;

type AreaLevel = keyof typeof LEVEL_CONFIG;

/**
 * Props for SelectedAreasList
 */
interface SelectedAreasListProps {
  areas: AreaInfo[];
  onRemove: (area_key: string) => void;
  isLoading?: boolean;
}

/**
 * SelectedAreasList - Shows selected areas grouped by level
 */
export function SelectedAreasList({ areas, onRemove, isLoading }: SelectedAreasListProps) {
  // Group by level
  const grouped = groupByLevel(areas);

  if (areas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MapPin className="h-12 w-12 text-gray-300 mb-3" />
        <p className="text-gray-500 font-medium">Ingen områder valgt</p>
        <p className="text-gray-400 text-sm mt-1">
          Klikk på et område på kartet for å velge det
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-320px)]">
      <div className="space-y-4 pr-4">
        {(["fylke", "kommune", "grunnkrets"] as AreaLevel[]).map((level) => {
          const levelAreas = grouped[level];
          if (levelAreas.length === 0) return null;

          const config = LEVEL_CONFIG[level];
          const Icon = config.icon;

          return (
            <div key={level} className="space-y-2">
              {/* Level header */}
              <div className={cn("flex items-center gap-2 px-2 py-1.5 rounded-md", config.bgColor)}>
                <Icon className={cn("h-4 w-4", config.color)} />
                <span className={cn("font-medium text-sm", config.color)}>
                  {config.labelPlural} ({levelAreas.length})
                </span>
              </div>

              {/* Level items */}
              <div className="space-y-1">
                {levelAreas.map((area) => (
                  <div
                    key={area.area_key}
                    className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{area.name}</p>
                      <p className="text-xs text-gray-500">{area.code}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(area.area_key)}
                      disabled={isLoading}
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                      aria-label={`Fjern ${area.name} fra valg`}
                    >
                      <X className="h-4 w-4 text-gray-500 hover:text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

/**
 * Props for LockedAreasList
 */
interface LockedAreasListProps {
  areas: LockedAreaInfo[];
  onUnlock: (area_keys: string[]) => void;
  isLoading?: boolean;
  searchQuery?: string;
}

/**
 * LockedAreasList - Shows locked areas grouped by level with unlock buttons
 */
export function LockedAreasList({ areas, onUnlock, isLoading, searchQuery }: LockedAreasListProps) {
  // Filter by search if provided
  const filteredAreas = searchQuery
    ? areas.filter(
        (area) =>
          area.area_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          area.area_code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : areas;

  // Group by level (area_type)
  const grouped = groupLockedByLevel(filteredAreas);

  if (areas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Unlock className="h-12 w-12 text-gray-300 mb-3" />
        <p className="text-gray-500 font-medium">Ingen låste områder</p>
        <p className="text-gray-400 text-sm mt-1">
          Velg områder og klikk &quot;Lås valgte&quot; for å låse dem
        </p>
      </div>
    );
  }

  if (filteredAreas.length === 0 && searchQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MapPin className="h-12 w-12 text-gray-300 mb-3" />
        <p className="text-gray-500 font-medium">Ingen treff</p>
        <p className="text-gray-400 text-sm mt-1">
          Prøv et annet søkeord
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-320px)]">
      <div className="space-y-4 pr-4">
        {(["fylke", "kommune", "grunnkrets"] as AreaLevel[]).map((level) => {
          const levelAreas = grouped[level];
          if (levelAreas.length === 0) return null;

          const config = LEVEL_CONFIG[level];
          const Icon = config.icon;

          return (
            <div key={level} className="space-y-2">
              {/* Level header */}
              <div className={cn("flex items-center gap-2 px-2 py-1.5 rounded-md", config.bgColor)}>
                <Icon className={cn("h-4 w-4", config.color)} />
                <span className={cn("font-medium text-sm", config.color)}>
                  {config.labelPlural} ({levelAreas.length})
                </span>
              </div>

              {/* Level items */}
              <div className="space-y-1">
                {levelAreas.map((area) => (
                  <div
                    key={area.area_key}
                    className="flex items-center justify-between px-3 py-2 bg-green-50 rounded-md hover:bg-green-100 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{area.area_name}</p>
                      <p className="text-xs text-gray-500">
                        {area.area_code} • Låst av {area.locked_by_name}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onUnlock([area.area_key])}
                      disabled={isLoading}
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 px-2 text-green-700 hover:text-green-900 hover:bg-green-200"
                      aria-label={`Lås opp ${area.area_name}`}
                    >
                      <Unlock className="h-4 w-4 mr-1" />
                      <span className="text-xs">Lås opp</span>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

/**
 * Helper to group AreaInfo by level
 */
function groupByLevel(areas: AreaInfo[]): Record<AreaLevel, AreaInfo[]> {
  const result: Record<AreaLevel, AreaInfo[]> = {
    fylke: [],
    kommune: [],
    grunnkrets: [],
  };

  areas.forEach((area) => {
    if (area.level in result) {
      result[area.level].push(area);
    }
  });

  // Sort each group by name
  Object.values(result).forEach((arr) => arr.sort((a, b) => a.name.localeCompare(b.name)));

  return result;
}

/**
 * Helper to group LockedAreaInfo by area_type
 */
function groupLockedByLevel(areas: LockedAreaInfo[]): Record<AreaLevel, LockedAreaInfo[]> {
  const result: Record<AreaLevel, LockedAreaInfo[]> = {
    fylke: [],
    kommune: [],
    grunnkrets: [],
  };

  areas.forEach((area) => {
    const level = area.area_type as AreaLevel;
    if (level in result) {
      result[level].push(area);
    }
  });

  // Sort each group by name
  Object.values(result).forEach((arr) => arr.sort((a, b) => a.area_name.localeCompare(b.area_name)));

  return result;
}


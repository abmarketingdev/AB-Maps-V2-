"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { fetchGrunnkretsStats } from "@/lib/demographics/api";
import type { GrunnkretsStatsResponse } from "@/lib/demographics/types";
import { Users, UserCheck, Calendar, TrendingUp, Lock, Unlock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAreasLockStore } from "@/stores/areasLockStore";

interface GrunnkretsStatsDrawerProps {
  open: boolean;
  onClose: () => void;
  code: string | null;
  name: string;
}

/**
 * GrunnkretsStatsDrawer Component
 * 
 * Phase 6: Right-side drawer with detailed statistics and charts
 * - Fetches stats from API with caching
 * - Shows summary cards
 * - Population pyramid chart
 * - Donor pool visualization
 * - Loading and error states
 */
export function GrunnkretsStatsDrawer({
  open,
  onClose,
  code,
  name,
}: GrunnkretsStatsDrawerProps) {
  const [stats, setStats] = useState<GrunnkretsStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch stats when code changes
  useEffect(() => {
    if (!code || !open) {
      setStats(null);
      return;
    }

    const loadStats = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchGrunnkretsStats(code);
        setStats(data);
      } catch (err) {
        console.error("[GrunnkretsStatsDrawer] Error fetching stats:", err);
        setError(err instanceof Error ? err.message : "Failed to load statistics");
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [code, open]);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-hidden p-0">
        <SheetHeader className="p-6 pb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <SheetTitle className="text-xl">{name || "Grunnkrets"}</SheetTitle>
              <SheetDescription>
                Kode: {code} • Demografisk statistikk
              </SheetDescription>
            </div>
            {/* Selection toggle for area locking (Phase 7) */}
            {code && name && (
              <SelectionToggle code={code} name={name} />
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)] px-6 pb-6">
          {loading && <LoadingSkeleton />}
          
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-red-700">
              <p className="font-medium">Feil ved lasting av data</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {stats && !loading && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <SummaryCards stats={stats} />

              {/* Population Pyramid */}
              <PopulationPyramid stats={stats} />

              {/* Donor Pool Card */}
              <DonorPoolCard stats={stats} />

              {/* Demographics Details */}
              <DemographicsDetails stats={stats} />
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Loading skeleton
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Summary cards showing key metrics
 */
function SummaryCards({ stats }: { stats: GrunnkretsStatsResponse }) {
  const cards = [
    {
      title: "Total befolkning",
      value: stats.totals?.population_total?.toLocaleString() ?? "N/A",
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: "Donorpool (stabil)",
      value: stats.donor_segments?.donor_pool_stable?.toLocaleString() ?? "N/A",
      icon: UserCheck,
      color: "text-purple-600",
    },
    {
      title: "Alder 67+",
      value: stats.donor_segments?.pop_67_plus?.toLocaleString() ?? "N/A",
      icon: Calendar,
      color: "text-green-600",
    },
    {
      title: "Gjennomsnittsalder",
      value: stats.mean_age_estimates?.total?.toFixed(1) ?? "N/A",
      icon: TrendingUp,
      color: "text-orange-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Population pyramid chart (horizontal bar chart)
 */
function PopulationPyramid({ stats }: { stats: GrunnkretsStatsResponse }) {
  // Transform data for pyramid chart from bins arrays
  const ageGroups = stats.bins?.age_groups ?? [];
  const maleData = stats.bins?.male ?? [];
  const femaleData = stats.bins?.female ?? [];
  
  const data = ageGroups.map((ageGroup, index) => ({
    ageGroup,
    male: -(maleData[index] || 0), // Negative for left side
    female: femaleData[index] || 0,
    maleAbs: maleData[index] || 0,
    femaleAbs: femaleData[index] || 0,
  }));

  // Calculate max value for symmetric axis
  const maxValue = Math.max(
    ...data.map((d) => Math.max(Math.abs(d.male), d.female))
  ) || 50;

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aldersfordeling</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Ingen aldersfordelingsdata tilgjengelig</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Befolkningspyramide</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 50, bottom: 5 }}
            >
              <XAxis
                type="number"
                domain={[-maxValue * 1.1, maxValue * 1.1]}
                tickFormatter={(v) => Math.abs(v).toString()}
              />
              <YAxis
                dataKey="ageGroup"
                type="category"
                width={45}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  Math.abs(value).toLocaleString(),
                  name === "male" ? "Menn" : "Kvinner",
                ]}
                labelFormatter={(label) => `Alder: ${label}`}
              />
              <Legend />
              <Bar dataKey="male" name="Menn" fill="#3b82f6" />
              <Bar dataKey="female" name="Kvinner" fill="#ec4899" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span>Menn: {stats.totals?.male_total?.toLocaleString() ?? "N/A"}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-pink-500" />
            <span>Kvinner: {stats.totals?.female_total?.toLocaleString() ?? "N/A"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Donor pool visualization card
 */
function DonorPoolCard({ stats }: { stats: GrunnkretsStatsResponse }) {
  const stable = stats.donor_segments?.donor_pool_stable ?? 0;
  const potential = stats.donor_segments?.donor_pool_adults ?? 0; // Using adults as potential
  const stableShare = stats.donor_segments?.share_30_66 ?? 0; // This is the share of 30-66 age group
  const total = stats.totals?.population_total ?? 1;

  // Calculate percentages
  const stablePercent = total > 0 ? ((stable / total) * 100).toFixed(1) : "0.0";
  const potentialPercent = total > 0 ? ((potential / total) * 100).toFixed(1) : "0.0";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Donorpool-analyse</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Stable Donors */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Stabile donorer</span>
              <span className="font-medium">{stable.toLocaleString()} ({stablePercent}%)</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all"
                style={{ width: `${Math.min(stableShare * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Potential Donors */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Potensielle donorer</span>
              <span className="font-medium">{potential.toLocaleString()} ({potentialPercent}%)</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-400 rounded-full transition-all"
                style={{ width: `${Math.min((potential / total) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{(stableShare * 100).toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Andel 30-66</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-indigo-600">{(stable + potential).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total pool</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Detailed demographics breakdown
 */
function DemographicsDetails({ stats }: { stats: GrunnkretsStatsResponse }) {
  const donorSegments = stats.donor_segments;
  const meanAge = stats.mean_age_estimates;
  
  if (!donorSegments && !meanAge) return null;

  const details = [
    {
      label: "Befolkning 67+",
      value: donorSegments?.pop_67_plus?.toLocaleString() ?? "N/A",
      subtext: `${((donorSegments?.share_67_plus ?? 0) * 100).toFixed(1)}% av total`,
    },
    {
      label: "Andel 30-66",
      value: `${((donorSegments?.share_30_66 ?? 0) * 100).toFixed(1)}%`,
      subtext: "Arbeidsfør befolkning",
    },
    {
      label: "Gjennomsnittsalder (Total)",
      value: meanAge?.total?.toFixed(1) ?? "N/A",
      subtext: "År",
    },
    {
      label: "Gjennomsnittsalder (Menn)",
      value: meanAge?.male?.toFixed(1) ?? "N/A",
      subtext: "År",
    },
    {
      label: "Gjennomsnittsalder (Kvinner)",
      value: meanAge?.female?.toFixed(1) ?? "N/A",
      subtext: "År",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Demografisk oversikt</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {details.map((item) => (
            <div key={item.label} className="flex justify-between items-center py-2 border-b last:border-0">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.subtext}</p>
              </div>
              <p className="text-lg font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * SelectionToggle Component
 * 
 * Phase 7: Toggle button for area locking in stats drawer
 * - Shows "Velg for låsing" if not selected/locked
 * - Shows "Fjern fra valg" if selected
 * - Shows "Låst" badge + "Lås opp" button if locked
 */
function SelectionToggle({ code, name }: { code: string; name: string }) {
  const selectedAreaKeys = useAreasLockStore((state) => state.selectedAreaKeys);
  const lockedAreaKeys = useAreasLockStore((state) => state.lockedAreaKeys);
  const toggleSelection = useAreasLockStore((state) => state.toggleSelection);
  const unlockAreas = useAreasLockStore((state) => state.unlockAreas);
  const isLoading = useAreasLockStore((state) => state.isLoading);

  const area_key = `grunnkrets:${code}`;
  const isSelected = selectedAreaKeys.has(area_key);
  const isLocked = lockedAreaKeys.has(area_key);

  // Handle selection toggle
  const handleToggle = () => {
    toggleSelection({
      area_key,
      name,
      code,
      level: 'grunnkrets',
    });
  };

  // Handle unlock
  const handleUnlock = () => {
    unlockAreas([area_key]);
  };

  // If locked, show badge and unlock button
  if (isLocked) {
    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
          <Lock className="h-3 w-3 mr-1" />
          Låst
        </Badge>
        <Button
          size="sm"
          variant="outline"
          onClick={handleUnlock}
          disabled={isLoading}
          className="text-green-700 border-green-300 hover:bg-green-50 hover:text-green-800"
        >
          <Unlock className="h-3 w-3 mr-1" />
          Lås opp
        </Button>
      </div>
    );
  }

  // If selected, show selected state
  if (isSelected) {
    return (
      <Button
        size="sm"
        variant="default"
        onClick={handleToggle}
        disabled={isLoading}
        className="bg-orange-500 hover:bg-orange-600 flex-shrink-0"
      >
        <Check className="h-3 w-3 mr-1" />
        Valgt
      </Button>
    );
  }

  // Default: show select button
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleToggle}
      disabled={isLoading}
      className="flex-shrink-0"
    >
      <Lock className="h-3 w-3 mr-1" />
      Velg for låsing
    </Button>
  );
}

export default GrunnkretsStatsDrawer;


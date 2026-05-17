"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ClientLayout from "../ClientLayout";
import { PageHeader } from "@/components/ui-ab";
import { SmartAvatar } from "@/components/gamification/SmartAvatar";

// Mascot thresholds — match production Terskler defaults. Used to compute
// employee mood from current jaProsent + dorerPerDag.
// TODO(backend): when threshold rollout lands, source from analyticsService.getThresholds().
const DEFAULT_MIN_JA_PROSENT = 3.0;
const DEFAULT_MIN_DORER_PER_DAG = 70;
import { cn } from "@/lib/utils";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  useAnalyticsPreview,
  useAnalyticsThresholds,
  useAnalyticsReports,
  useWorkTimeStats,
} from "@/hooks/useAnalytics";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

// Recharts
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

// Icons
import {
  BarChart3,
  TrendingUp,
  Activity,
  Download,
  Send,
  Calendar,
  RefreshCw,
  AlertCircle,
  Loader2,
  Users,
  DoorOpen,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  Trophy,
  Medal,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Hash,
  Plus,
  Pencil,
  Trash2,
  Shield,
  Globe,
  Building2,
  UserCircle,
  Search,
  Eye,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Bell,
  Mail,
  User,
  TrendingDown,
  Gauge,
  CalendarDays,
  FileText,
  X,
} from "lucide-react";

// Types from service
import type {
  AnalyticsPreviewResponse,
  AnalyticsSummary,
  ComparisonMetric,
  Alert,
  DailyBreakdown,
  HourlyBreakdown,
  CampaignAnalytics,
  NeiBreakdown,
  EmployeeAnalytics,
  TopPerformers,
  Threshold,
  ThresholdScope,
  CreateThresholdData,
  AlertDailyDetail,
  WorkTimeStatsResponse,
  WorkTimePersonEntry,
  WorkTimeSummary,
} from "@/services/analyticsService";

// Services for fetching dropdown options
import { fetchAllCampaigns, type Campaign } from "@/services/campaignService";
import { fetchManagersAndAdmins, type AssignableUser } from "@/services/userService";
import { API_CONFIG, buildApiUrl } from "@/lib/config/apiConfig";
import { authService } from "@/lib/auth/authService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise an Alert so every field is safe to access (guards against undefined from API) */
function safeAlert(a: Alert): Alert & {
  severity: "critical" | "warning" | "info";
  type: string;
  employee_id: string;
  employee_name: string;
  message: string;
  metric: string;
  value: number;
  threshold: number;
} {
  return {
    ...a,
    severity: a.severity ?? "info",
    type: a.type ?? "unknown",
    employee_id: a.employee_id ?? "",
    employee_name: a.employee_name ?? "Ukjent",
    message: a.message ?? "",
    metric: a.metric ?? "",
    value: typeof a.value === "number" ? a.value : 0,
    threshold: typeof a.threshold === "number" ? a.threshold : 0,
  };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatSeconds(seconds: number): string {
  if (!seconds || seconds < 0) return "0t 0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}t ${m}m`;
}

/** Quick-range presets for date selection */
const DATE_PRESETS = [
  { label: "Siste 7 dager", days: 7 },
  { label: "Siste 14 dager", days: 14 },
  { label: "Siste 30 dager", days: 30 },
  { label: "Siste 60 dager", days: 60 },
  { label: "Siste 90 dager", days: 90 },
] as const;

// ---------------------------------------------------------------------------
// Sub-components: Loading skeletons
// ---------------------------------------------------------------------------

function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-3 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-3 w-52 mt-1" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[250px] w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Error banner
// ---------------------------------------------------------------------------

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="flex items-center gap-3 p-4">
        <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
        <p className="text-sm text-destructive flex-1">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-2 h-3 w-3" />
            Prøv igjen
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Comparison badge (shows +/- change)
// ---------------------------------------------------------------------------

function ChangeBadge({ metric }: { metric?: ComparisonMetric }) {
  if (!metric) return null;
  const pct = metric.change_pct;
  if (pct === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> 0%
      </span>
    );
  }
  const isPositive = pct > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isPositive ? "text-green-600" : "text-red-600"
      }`}
    >
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {isPositive ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Summary cards
// ---------------------------------------------------------------------------

function SummaryCards({
  summary,
  comparisons,
}: {
  summary: AnalyticsSummary;
  comparisons?: AnalyticsPreviewResponse["comparisons"];
}) {
  // Hero metric (kept large)
  const heroLabel = "Totale dører";
  const heroValue = summary.total_doors.toLocaleString();
  const heroComparison = comparisons?.total_doors;

  // Secondary stacked rows
  const secondary = [
    {
      label: "Ja-prosent",
      value: `${summary.yes_rate.toFixed(1)}%`,
      comparison: comparisons?.yes_rate,
      icon: Target,
      iconColor: "text-ab-success",
      iconBg: "bg-ab-success-bg",
    },
    {
      label: "Kontaktprosent",
      value: `${summary.contact_rate.toFixed(1)}%`,
      comparison: comparisons?.contact_rate,
      icon: Users,
      iconColor: "text-ab-accent",
      iconBg: "bg-ab-accent/10",
    },
    {
      label: "Dører / dag",
      value: summary.doors_per_day.toFixed(1),
      comparison: comparisons?.doors_per_day,
      icon: TrendingUp,
      iconColor: "text-ab-warning",
      iconBg: "bg-ab-warning-bg",
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4">
      {/* Hero — TOTALE DØRER */}
      <div className="card-premium p-6 flex flex-col justify-between gap-4 min-h-[180px]">
        <div className="flex items-start justify-between">
          <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
            {heroLabel}
          </div>
          <div className="p-2.5 rounded-lg bg-ab-accent/10">
            <DoorOpen className="h-4 w-4 text-ab-accent" />
          </div>
        </div>
        <div className="text-[40px] font-bold tracking-tight leading-none text-ab-fg tabular">
          {heroValue}
        </div>
        <ChangeBadge metric={heroComparison} />
      </div>

      {/* Three stacked secondary rows */}
      <div className="card-premium divide-y divide-ab-line-1 overflow-hidden">
        {secondary.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="flex items-center gap-3 px-5 py-4"
            >
              <div className={cn("p-2 rounded-lg shrink-0", card.iconBg)}>
                <Icon className={cn("h-4 w-4", card.iconColor)} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wider text-ab-fg-3 font-medium">
                  {card.label}
                </div>
                <div className="text-[22px] font-semibold text-ab-fg tabular leading-tight mt-0.5">
                  {card.value}
                </div>
              </div>
              <ChangeBadge metric={card.comparison} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Status breakdown (secondary row)
// ---------------------------------------------------------------------------

function StatusBreakdown({ summary }: { summary: AnalyticsSummary }) {
  const items = [
    { label: "Ja", value: summary.ja, rate: summary.yes_rate, color: "text-green-600", bg: "bg-green-500" },
    { label: "Nei", value: summary.nei, rate: summary.no_rate, color: "text-red-600", bg: "bg-red-500" },
    { label: "Ikke hjemme", value: summary.ikke_hjemme, rate: summary.not_home_rate, color: "text-yellow-600", bg: "bg-yellow-500" },
    { label: "Følg opp", value: summary.folg_opp, rate: summary.follow_up_rate, color: "text-blue-600", bg: "bg-blue-500" },
  ];

  const total = summary.total_doors || 1; // avoid /0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Statusfordeling</CardTitle>
        <CardDescription>Oversikt over dørbanking-resultater</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stacked bar */}
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
          {items.map((item) => (
            <div
              key={item.label}
              className={`${item.bg} transition-all`}
              style={{ width: `${(item.value / total) * 100}%` }}
            />
          ))}
        </div>
        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {items.map((item) => (
            <div key={item.label} className="text-center">
              <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-muted-foreground">
                {item.label} ({item.rate.toFixed(1)}%)
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Talkmore "Nei-årsaker" breakdown
// ---------------------------------------------------------------------------

const NEI_REASON_LABELS: Record<keyof NeiBreakdown, string> = {
  ikke_interessert: "Ikke interessert",
  darlig_erfaring: "Dårlig erfaring",
  bindingstid: "Bindingstid",
  bedrift: "Bedrift",
  pris: "Pris",
  eksisterende_kunde: "Eksisterende kunde",
  unspecified: "Ikke oppgitt",
};

function mergeNeiBreakdowns(campaigns: CampaignAnalytics[]): NeiBreakdown {
  const out: NeiBreakdown = {
    ikke_interessert: 0,
    darlig_erfaring: 0,
    bindingstid: 0,
    bedrift: 0,
    pris: 0,
    eksisterende_kunde: 0,
    unspecified: 0,
  };
  for (const c of campaigns) {
    if (!c.is_talkmore || !c.nei_breakdown) continue;
    (Object.keys(out) as (keyof NeiBreakdown)[]).forEach((k) => {
      out[k] += c.nei_breakdown![k] ?? 0;
    });
  }
  return out;
}

function TalkmoreNeiBreakdownCard({
  breakdown,
  multipleCampaigns,
}: {
  breakdown: NeiBreakdown;
  multipleCampaigns: boolean;
}) {
  const totalNei = (Object.values(breakdown) as number[]).reduce((s, v) => s + v, 0);

  const title = multipleCampaigns
    ? "Nei-årsaker (Talkmore-kampanjer)"
    : "Nei-årsaker (Talkmore)";

  if (totalNei === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>Fordeling av avslag etter årsak</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ingen avslag i valgt periode.
          </p>
        </CardContent>
      </Card>
    );
  }

  const entries = (Object.keys(NEI_REASON_LABELS) as (keyof NeiBreakdown)[])
    .map((key) => ({
      key,
      label: NEI_REASON_LABELS[key],
      count: breakdown[key] ?? 0,
    }))
    .filter((e) => e.count > 0)
    .sort((a, b) => {
      if (a.key === "unspecified") return 1;
      if (b.key === "unspecified") return -1;
      return b.count - a.count;
    });

  const maxCount = Math.max(...entries.map((e) => e.count));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Fordeling av avslag etter årsak</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.map((entry) => {
          const pct = (entry.count / totalNei) * 100;
          const barWidth = (entry.count / maxCount) * 100;
          const isUnspecified = entry.key === "unspecified";
          return (
            <div key={entry.key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className={`font-medium ${isUnspecified ? "text-muted-foreground" : ""}`}>
                  {entry.label}
                </span>
                <div className="flex items-center gap-3 tabular-nums">
                  <span className="text-muted-foreground">{entry.count}</span>
                  <span className="font-semibold w-14 text-right">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all ${
                    isUnspecified ? "bg-muted-foreground/40" : "bg-red-500"
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Alerts panel
// ---------------------------------------------------------------------------

function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  if (!alerts || alerts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Ingen aktive varsler. Alle mål er innenfor terskler.
          </div>
        </CardContent>
      </Card>
    );
  }

  const severityIcon = (severity: Alert["severity"]) => {
    switch (severity) {
      case "critical": return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
      case "warning":  return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />;
      case "info":     return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
    }
  };

  const severityBorder = (severity: Alert["severity"]) => {
    switch (severity) {
      case "critical": return "border-l-red-500";
      case "warning":  return "border-l-yellow-500";
      case "info":     return "border-l-blue-500";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Varsler</CardTitle>
          <Badge variant="destructive" className="text-xs">
            {alerts.length} aktive
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
        {alerts.map((alert, i) => (
          <div
            key={`${alert.employee_id}-${alert.type}-${i}`}
            className={`rounded-md border border-l-4 ${severityBorder(alert.severity)} p-3`}
          >
            <div className="flex items-start gap-2">
              {severityIcon(alert.severity)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{alert.employee_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
              </div>
              <Badge variant="outline" className="text-xs capitalize shrink-0">
                {alert.severity}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Alert Severity Summary Card (Phase 2)
// ---------------------------------------------------------------------------

function AlertSeverityCard({
  severity,
  count,
  description,
}: {
  severity: "critical" | "warning" | "info" | "total";
  count: number;
  description: string;
}) {
  const config = {
    critical: {
      label: "KRITISK",
      bg: "bg-ab-elevated border-ab-line",
      textColor: "text-ab-fg-2",
      countColor: "text-ab-fg",
      descColor: "text-ab-fg-3",
      icon: <XCircle className="h-5 w-5 text-ab-danger" />,
    },
    warning: {
      label: "ADVARSEL",
      bg: "bg-ab-elevated border-ab-line",
      textColor: "text-ab-fg-2",
      countColor: "text-ab-fg",
      descColor: "text-ab-fg-3",
      icon: <AlertTriangle className="h-5 w-5 text-ab-warning" />,
    },
    info: {
      label: "INFO",
      bg: "bg-ab-elevated border-ab-line",
      textColor: "text-ab-fg-2",
      countColor: "text-ab-fg",
      descColor: "text-ab-fg-3",
      icon: <Info className="h-5 w-5 text-ab-accent" />,
    },
    total: {
      label: "TOTALT",
      bg: "bg-ab-elevated border-ab-line",
      textColor: "text-ab-fg-2",
      countColor: "text-ab-fg",
      descColor: "text-ab-fg-3",
      icon: <BarChart3 className="h-5 w-5 text-ab-fg-3" />,
    },
  };

  const c = config[severity];

  return (
    <Card className={`border ${c.bg} overflow-hidden transition-shadow hover:shadow-md`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className={`text-xs font-semibold uppercase tracking-wider ${c.textColor}`}>
              {c.label}
            </p>
            <p className={`text-3xl font-bold ${c.countColor}`}>{count}</p>
            <p className={`text-xs ${c.descColor}`}>{description}</p>
          </div>
          <div className="mt-0.5">{c.icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Mini Trend Bars (7-day sparkline with tooltips — Phase 4)
// ---------------------------------------------------------------------------

function MiniTrendBars({
  dailyDetails,
  threshold,
  height = 40,
}: {
  dailyDetails?: AlertDailyDetail[];
  threshold: number;
  height?: number;
}) {
  // Empty state — placeholder bars
  if (!dailyDetails || dailyDetails.length === 0) {
    return (
      <div className="flex items-end gap-[3px]" style={{ height, width: 80 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-gray-200 rounded-sm animate-pulse"
            style={{ height: 4 }}
          />
        ))}
      </div>
    );
  }

  const sliced = dailyDetails.slice(-7);
  const maxVal = Math.max(...sliced.map((d) => d.doors), threshold, 1);
  const thresholdPx = (threshold / maxVal) * height;

  return (
    <TooltipProvider delayDuration={80}>
      <div className="relative flex items-end gap-[3px]" style={{ height, width: 80 }}>
        {/* Threshold reference line */}
        {threshold > 0 && (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-gray-400/60 pointer-events-none z-10"
            style={{ bottom: `${thresholdPx}px` }}
          />
        )}

        {sliced.map((d, i) => {
          const barH = Math.max((d.doors / maxVal) * height, 3);
          const isBelow = d.below_doors_threshold;
          const fmtDate = new Date(d.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div
                  className={`flex-1 rounded-sm cursor-default transition-all duration-150 hover:opacity-80 ${
                    isBelow
                      ? "bg-gradient-to-t from-red-500 to-red-400"
                      : "bg-gradient-to-t from-blue-500 to-blue-400"
                  }`}
                  style={{ height: `${barH}px` }}
                />
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="text-xs p-2 space-y-0.5"
              >
                <p className="font-semibold">{fmtDate}</p>
                <p className="text-muted-foreground">
                  {d.doors} dører &bull; {d.yes_rate.toFixed(1)}% ja
                </p>
                {isBelow && (
                  <p className="text-red-500 font-medium text-[11px]">
                    ⚠ Under terskel
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Detailed Alert Card (Phase 3 — matches reference screenshot)
// ---------------------------------------------------------------------------

function AlertCardDetailed({
  alert: rawAlert,
  onViewDetails,
  onDismiss,
}: {
  alert: Alert;
  onViewDetails: () => void;
  onDismiss: () => void;
}) {
  const alert = safeAlert(rawAlert);
  const [expanded, setExpanded] = useState(false);

  const severityCfg = {
    critical: {
      border: "border-l-red-500",
      badge: "bg-red-100 text-red-800 border-red-200",
      icon: <XCircle className="h-3 w-3" />,
      avatarRing: "ring-red-200",
      avatarBadge: "bg-red-500",
      progress: "bg-red-500",
      progressTrack: "bg-red-100",
    },
    warning: {
      border: "border-l-orange-500",
      badge: "bg-orange-100 text-orange-800 border-orange-200",
      icon: <AlertTriangle className="h-3 w-3" />,
      avatarRing: "ring-orange-200",
      avatarBadge: "bg-orange-500",
      progress: "bg-orange-500",
      progressTrack: "bg-orange-100",
    },
    info: {
      border: "border-l-blue-500",
      badge: "bg-blue-100 text-blue-800 border-blue-200",
      icon: <Info className="h-3 w-3" />,
      avatarRing: "ring-blue-200",
      avatarBadge: "bg-blue-500",
      progress: "bg-blue-500",
      progressTrack: "bg-blue-100",
    },
  } as const;

  const cfg = severityCfg[alert.severity];

  // Metrics
  const isRate =
    alert.metric.includes("rate") || alert.metric.includes("percent");
  const unit = isRate ? "%" : " dører/dag";
  const deficit = alert.value - alert.threshold;
  // For "minimum" metrics (doors, yes_rate, contact_rate) deficit < 0 is bad.
  // For "maximum" metrics (no_rate) deficit > 0 is bad.
  const isDeficitBad =
    alert.metric === "no_rate" || alert.metric === "max_no_rate_percent"
      ? deficit > 0
      : deficit < 0;

  const progressPct =
    alert.threshold > 0
      ? Math.min((alert.value / alert.threshold) * 100, 100)
      : 0;

  const initials = alert.employee_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hasDailyDetails =
    alert.daily_details && alert.daily_details.length > 0;

  return (
    <Card
      className={`border-l-4 ${cfg.border} hover:shadow-lg transition-all duration-200 group overflow-hidden`}
    >
      <CardContent className="p-0">
        {/* ── Main row ── */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 pb-3">
          {/* ── 1. Employee info + alert badge ── */}
          <div className="flex items-center gap-3 lg:w-[250px] shrink-0">
            {/* Avatar with severity badge overlay */}
            <div className="relative shrink-0">
              <div
                className={`h-11 w-11 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600 ring-2 ${cfg.avatarRing} shadow-sm`}
              >
                {initials}
              </div>
              <div
                className={`absolute -bottom-0.5 -right-0.5 h-[18px] w-[18px] rounded-full flex items-center justify-center border-2 border-white ${cfg.avatarBadge} shadow-sm`}
              >
                <span className="text-white text-[8px] font-bold leading-none">
                  {alert.severity === "info" ? "i" : "!"}
                </span>
              </div>
            </div>

            {/* Name + type badge */}
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold truncate leading-tight">
                {alert.employee_name}
              </p>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase leading-none px-2 py-[3px] rounded border whitespace-nowrap ${cfg.badge}`}
              >
                {cfg.icon}
                <span className="truncate max-w-[160px]">
                  {alert.type.replace(/_/g, " ")}
                  {alert.consecutive_days
                    ? ` - ${alert.consecutive_days} dager`
                    : ""}
                </span>
              </span>
            </div>
          </div>

          {/* ── 2. Performance metrics row ── */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              {/* Metric + progress bar */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Ytelse
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold tabular-nums">
                    {isRate
                      ? `${alert.value.toFixed(1)}%`
                      : alert.value.toFixed(1)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    / {alert.threshold}
                    {unit}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="space-y-0.5">
                  <div
                    className={`h-[6px] w-full rounded-full ${cfg.progressTrack} overflow-hidden`}
                  >
                    <div
                      className={`h-full rounded-full ${cfg.progress} transition-all duration-500`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground tabular-nums text-right">
                    {progressPct.toFixed(0)}%
                  </p>
                </div>
              </div>

              {/* 7-Day Trend (Phase 4) */}
              <div className="space-y-1.5 flex flex-col items-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  7-dagers trend
                </p>
                <MiniTrendBars
                  dailyDetails={alert.daily_details}
                  threshold={alert.threshold}
                  height={36}
                />
              </div>

              {/* Deficit / Gap */}
              <div className="space-y-1.5 text-right sm:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {isRate ? "Prosentgap" : "Underskuddsgap"}
                </p>
                <p
                  className={`text-xl font-bold tabular-nums ${
                    isDeficitBad ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {deficit > 0 ? "+" : ""}
                  {isRate ? `${deficit.toFixed(1)}%` : deficit.toFixed(1)}
                </p>
              </div>
            </div>
          </div>

          {/* ── 3. Action buttons ── */}
          <div className="flex items-center gap-1 lg:flex-col shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-xs h-7 px-2"
              onClick={onViewDetails}
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              Vis detaljer
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-gray-700 text-xs h-7 px-2"
              onClick={onDismiss}
            >
              Avvis
            </Button>
            {hasDailyDetails && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-400 hover:text-gray-600"
                onClick={() => setExpanded((v) => !v)}
                title={expanded ? "Skjul daglige detaljer" : "Vis daglige detaljer"}
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* ── Expandable daily breakdown ── */}
        {expanded && hasDailyDetails && (
          <div className="border-t bg-muted/30 px-4 py-3 animate-in slide-in-from-top-1 duration-200">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Daglig oversikt (siste {alert.daily_details!.length} dager)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1.5 pr-3 font-medium">Dato</th>
                    <th className="text-right py-1.5 px-3 font-medium">Dører</th>
                    <th className="text-right py-1.5 px-3 font-medium">Ja</th>
                    <th className="text-right py-1.5 px-3 font-medium">Ja-prosent</th>
                    <th className="text-center py-1.5 pl-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {alert.daily_details!.map((day, idx) => {
                    const dayDate = new Date(day.date).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", weekday: "short" },
                    );
                    const isBelowDoors = day.below_doors_threshold;
                    const isBelowYes = day.below_yes_rate_threshold;
                    const isAnyBelow = isBelowDoors || isBelowYes;
                    return (
                      <tr
                        key={idx}
                        className={`border-b last:border-0 transition-colors ${
                          isAnyBelow ? "bg-red-50/60" : ""
                        }`}
                      >
                        <td className="py-1.5 pr-3 font-medium">{dayDate}</td>
                        <td
                          className={`text-right py-1.5 px-3 tabular-nums ${
                            isBelowDoors ? "text-red-600 font-bold" : ""
                          }`}
                        >
                          {day.doors}
                        </td>
                        <td className="text-right py-1.5 px-3 tabular-nums">
                          {day.ja}
                        </td>
                        <td
                          className={`text-right py-1.5 px-3 tabular-nums ${
                            isBelowYes ? "text-red-600 font-bold" : ""
                          }`}
                        >
                          {day.yes_rate.toFixed(1)}%
                        </td>
                        <td className="text-center py-1.5 pl-3">
                          {isAnyBelow ? (
                            <span className="inline-flex items-center gap-1 text-red-600">
                              <XCircle className="h-3 w-3" />
                              Under
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-3 w-3" />
                              OK
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Alert Detail Dialog (View Details → employee-level view)
// ---------------------------------------------------------------------------

function AlertDetailDialog({
  alert: rawAlert,
  open,
  onOpenChange,
  onViewEmployeeStats,
}: {
  alert: Alert | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewEmployeeStats?: (employeeId: string) => void;
}) {
  if (!rawAlert) return null;
  const alert = safeAlert(rawAlert);

  const isRate =
    alert.metric.includes("rate") || alert.metric.includes("percent");
  const unit = isRate ? "%" : " dører/dag";
  const deficit = alert.value - alert.threshold;
  const isDeficitBad =
    alert.metric === "no_rate" || alert.metric === "max_no_rate_percent"
      ? deficit > 0
      : deficit < 0;
  const progressPct =
    alert.threshold > 0
      ? Math.min((alert.value / alert.threshold) * 100, 100)
      : 0;

  const severityStyles = {
    critical: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
      badge: "bg-red-100 text-red-800",
      icon: <XCircle className="h-5 w-5 text-red-500" />,
      progress: "bg-red-500",
      avatarRing: "ring-red-300",
    },
    warning: {
      bg: "bg-orange-50",
      border: "border-orange-200",
      text: "text-orange-700",
      badge: "bg-orange-100 text-orange-800",
      icon: <AlertTriangle className="h-5 w-5 text-orange-500" />,
      progress: "bg-orange-500",
      avatarRing: "ring-orange-300",
    },
    info: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
      badge: "bg-blue-100 text-blue-800",
      icon: <Info className="h-5 w-5 text-blue-500" />,
      progress: "bg-blue-500",
      avatarRing: "ring-blue-300",
    },
  } as const;

  const s = severityStyles[alert.severity];
  const initials = alert.employee_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[88vh] p-0 gap-0 overflow-hidden">
        {/* ── Header ── */}
        <div className={`${s.bg} border-b ${s.border} px-6 py-5`}>
          <div className="flex items-start gap-4">
            <div
              className={`h-14 w-14 rounded-full bg-white flex items-center justify-center text-lg font-bold text-gray-700 ring-2 ${s.avatarRing} shadow-sm shrink-0`}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-lg">
                  {alert.employee_name}
                </DialogTitle>
                <Badge
                  className={`text-xs uppercase font-semibold ${s.badge}`}
                >
                  {alert.severity}
                </Badge>
              </div>
              <DialogDescription className="mt-1 text-sm">
                {alert.message}
              </DialogDescription>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {alert.type.replace(/_/g, " ")}
                </span>
                {alert.consecutive_days && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {alert.consecutive_days} påfølgende dager
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <ScrollArea className="max-h-[calc(88vh-180px)]">
          <div className="p-6 space-y-6">
            {/* ── Performance Summary Cards ── */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="border">
                <CardContent className="p-4 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Nåværende
                  </p>
                  <p className="text-2xl font-bold mt-1 tabular-nums">
                    {isRate
                      ? `${alert.value.toFixed(1)}%`
                      : alert.value.toFixed(1)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border">
                <CardContent className="p-4 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Terskel
                  </p>
                  <p className="text-2xl font-bold mt-1 tabular-nums text-muted-foreground">
                    {alert.threshold}
                    {unit}
                  </p>
                </CardContent>
              </Card>
              <Card className={`border ${isDeficitBad ? "border-red-200 bg-red-50/50" : "border-green-200 bg-green-50/50"}`}>
                <CardContent className="p-4 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {isRate ? "Prosentgap" : "Underskudd"}
                  </p>
                  <p
                    className={`text-2xl font-bold mt-1 tabular-nums ${
                      isDeficitBad ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {deficit > 0 ? "+" : ""}
                    {isRate ? `${deficit.toFixed(1)}%` : deficit.toFixed(1)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* ── Progress bar ── */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Ytelse vs terskel
                </p>
                <p className="text-xs font-semibold tabular-nums">
                  {progressPct.toFixed(0)}%
                </p>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${s.progress} transition-all duration-700`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* ── 7-Day Trend (larger) ── */}
            {alert.daily_details && alert.daily_details.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  7-dagers trend
                </p>
                <div className="flex justify-center">
                  <MiniTrendBars
                    dailyDetails={alert.daily_details}
                    threshold={alert.threshold}
                    height={64}
                  />
                </div>
              </div>
            )}

            {/* ── Daily Breakdown Table ── */}
            {alert.daily_details && alert.daily_details.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Daglig oversikt
                </p>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="text-xs h-8 pl-4">
                          Dato
                        </TableHead>
                        <TableHead className="text-xs h-8 text-right">
                          Dører
                        </TableHead>
                        <TableHead className="text-xs h-8 text-right">
                          Ja
                        </TableHead>
                        <TableHead className="text-xs h-8 text-right">
                          Ja-prosent
                        </TableHead>
                        <TableHead className="text-xs h-8 text-center pr-4">
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alert.daily_details.map((day, idx) => {
                        const fmtDate = new Date(
                          day.date,
                        ).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        });
                        const isBad =
                          day.below_doors_threshold ||
                          day.below_yes_rate_threshold;
                        return (
                          <TableRow
                            key={idx}
                            className={
                              isBad ? "bg-red-50/60" : "hover:bg-muted/30"
                            }
                          >
                            <TableCell className="py-2 pl-4 text-xs font-medium">
                              {fmtDate}
                            </TableCell>
                            <TableCell
                              className={`py-2 text-xs text-right tabular-nums ${
                                day.below_doors_threshold
                                  ? "text-red-600 font-bold"
                                  : ""
                              }`}
                            >
                              {day.doors}
                            </TableCell>
                            <TableCell className="py-2 text-xs text-right tabular-nums">
                              {day.ja}
                            </TableCell>
                            <TableCell
                              className={`py-2 text-xs text-right tabular-nums ${
                                day.below_yes_rate_threshold
                                  ? "text-red-600 font-bold"
                                  : ""
                              }`}
                            >
                              {day.yes_rate.toFixed(1)}%
                            </TableCell>
                            <TableCell className="py-2 text-center pr-4">
                              {isBad ? (
                                <Badge
                                  variant="destructive"
                                  className="text-[10px] h-5 px-1.5"
                                >
                                  Under
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] h-5 px-1.5 text-green-600 border-green-200"
                                >
                                  OK
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* ── Alert message (full) ── */}
            <Card className={`${s.bg} border ${s.border}`}>
              <CardContent className="p-4 flex gap-3">
                {s.icon}
                <div className="text-sm">
                  <p className={`font-medium ${s.text}`}>Varseldetaljer</p>
                  <p className="text-muted-foreground mt-0.5">
                    {alert.message}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        {/* ── Footer ── */}
        <div className="border-t px-6 py-3 flex items-center justify-end gap-2 bg-white">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Lukk
            </Button>
            {onViewEmployeeStats && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                onClick={() => {
                  onOpenChange(false);
                  onViewEmployeeStats(alert.employee_id);
                }}
              >
                <User className="h-3.5 w-3.5" />
                Ansattstatistikk
              </Button>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Employee Stats Modal (Phase 8 — dedicated employee view)
// ---------------------------------------------------------------------------

function EmployeeStatsModal({
  employeeId,
  open,
  onOpenChange,
  alerts,
  employees,
}: {
  employeeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerts: Alert[];
  employees: EmployeeAnalytics[];
}) {
  if (!employeeId || !open) return null;

  const emp = employees.find((e) => e.employee_id === employeeId);
  const empAlerts = alerts.filter((a) => a.employee_id === employeeId).map(safeAlert);

  if (!emp) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ansatt ikke funnet</DialogTitle>
            <DialogDescription>
              Ingen analytikkdata funnet for denne ansatten i den nåværende perioden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Lukk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Derived metrics ──
  const initials = emp.employee_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const worstSeverity = empAlerts.some((a) => a.severity === "critical")
    ? "critical"
    : empAlerts.some((a) => a.severity === "warning")
    ? "warning"
    : empAlerts.length > 0
    ? "info"
    : "good";

  const statusConfig = {
    critical: {
      label: "Kritisk",
      bg: "bg-red-500",
      ring: "ring-red-300",
      badge: "bg-red-100 text-red-800 border-red-200",
      headerBg: "bg-red-50",
      headerBorder: "border-red-200",
    },
    warning: {
      label: "Advarsel",
      bg: "bg-orange-500",
      ring: "ring-orange-300",
      badge: "bg-orange-100 text-orange-800 border-orange-200",
      headerBg: "bg-orange-50",
      headerBorder: "border-orange-200",
    },
    info: {
      label: "Info",
      bg: "bg-blue-500",
      ring: "ring-blue-300",
      badge: "bg-blue-100 text-blue-800 border-blue-200",
      headerBg: "bg-blue-50",
      headerBorder: "border-blue-200",
    },
    good: {
      label: "Bra",
      bg: "bg-green-500",
      ring: "ring-green-300",
      badge: "bg-green-100 text-green-800 border-green-200",
      headerBg: "bg-green-50",
      headerBorder: "border-green-200",
    },
  } as const;

  const sc = statusConfig[worstSeverity];

  // Helper to build metric cards
  const metricCards: Array<{
    title: string;
    current: number;
    threshold: number | null;
    unit: string;
    type: "min" | "max";
  }> = [];

  // Find thresholds from alerts
  const doorThreshold =
    empAlerts.find(
      (a) => a.metric === "doors_per_day" || a.metric === "min_doors_per_day",
    )?.threshold ?? null;
  const yesThreshold =
    empAlerts.find(
      (a) =>
        a.metric === "yes_rate" || a.metric === "min_yes_rate_percent",
    )?.threshold ?? null;
  const noThreshold =
    empAlerts.find(
      (a) =>
        a.metric === "no_rate" || a.metric === "max_no_rate_percent",
    )?.threshold ?? null;
  const contactThreshold =
    empAlerts.find(
      (a) =>
        a.metric === "contact_rate" ||
        a.metric === "min_contact_rate_percent",
    )?.threshold ?? null;

  metricCards.push(
    {
      title: "Dører/dag",
      current: emp.doors_per_day,
      threshold: doorThreshold,
      unit: "",
      type: "min",
    },
    {
      title: "Ja-prosent",
      current: emp.yes_rate,
      threshold: yesThreshold,
      unit: "%",
      type: "min",
    },
    {
      title: "Nei-prosent",
      current: emp.no_rate,
      threshold: noThreshold,
      unit: "%",
      type: "max",
    },
    {
      title: "Kontaktprosent",
      current: emp.contact_rate,
      threshold: contactThreshold,
      unit: "%",
      type: "min",
    },
  );

  // ── Daily details from alerts (get the longest daily_details for chart) ──
  const longestDD =
    empAlerts
      .filter((a) => a.daily_details && a.daily_details.length > 0)
      .sort(
        (a, b) =>
          (b.daily_details?.length ?? 0) - (a.daily_details?.length ?? 0),
      )[0]?.daily_details ?? [];

  // Chart data from daily_door_counts
  const dailyChartData = useMemo(() => {
    return Object.entries(emp.daily_door_counts || {})
      .map(([date, doors]) => ({
        date,
        doors: doors as number,
        label: new Date(date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [emp.daily_door_counts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] p-0 gap-0 overflow-hidden">
        {/* ── 1. Employee Header ── */}
        <div
          className={`${sc.headerBg} border-b ${sc.headerBorder} px-6 py-5`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div
                className={`h-16 w-16 rounded-full bg-white flex items-center justify-center text-xl font-bold text-gray-700 ring-2 ${sc.ring} shadow-sm shrink-0`}
              >
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-xl">
                    {emp.employee_name}
                  </DialogTitle>
                  <Badge className={`text-xs uppercase font-semibold ${sc.badge}`}>
                    {sc.label}
                  </Badge>
                </div>
                <DialogDescription className="mt-1 text-sm">
                  Feltagent &bull; Konsistensscore:{" "}
                  <span className="font-semibold">
                    {emp.consistency_score.toFixed(0)}%
                  </span>
                </DialogDescription>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <DoorOpen className="h-3.5 w-3.5" />
                    {emp.total_doors} totale dører
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Target className="h-3.5 w-3.5" />
                    {emp.doors_per_day.toFixed(1)} dører/dag snitt
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {empAlerts.length} aktive varsler
                  </span>
                </div>
              </div>
            </div>
            {/* Close button */}
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-full p-1 hover:bg-black/5 transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <ScrollArea className="max-h-[calc(92vh-130px)]">
          <div className="p-6 space-y-6">
            {/* ── 2. Performance Summary Cards ── */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Ytelsesmål
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {metricCards.map((mc) => {
                  const pct =
                    mc.threshold && mc.threshold > 0
                      ? (mc.current / mc.threshold) * 100
                      : null;
                  const isBad =
                    mc.threshold != null
                      ? mc.type === "min"
                        ? mc.current < mc.threshold
                        : mc.current > mc.threshold
                      : false;
                  const cardBorder = isBad
                    ? "border-red-200 bg-red-50/40"
                    : mc.threshold != null
                    ? "border-green-200 bg-green-50/30"
                    : "border-gray-200";
                  const progressColor = isBad ? "bg-red-500" : "bg-green-500";

                  return (
                    <Card key={mc.title} className={`border ${cardBorder}`}>
                      <CardContent className="p-4 space-y-3">
                        <p className="text-xs font-medium text-muted-foreground">
                          {mc.title}
                        </p>
                        <div className="text-center">
                          <p className="text-2xl font-bold tabular-nums">
                            {mc.current.toFixed(1)}
                            {mc.unit}
                          </p>
                          {mc.threshold != null && (
                            <>
                              <div className="h-px bg-gray-200 my-1.5 mx-auto w-12" />
                              <p className="text-sm text-muted-foreground tabular-nums">
                                {mc.threshold}
                                {mc.unit}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                (terskel)
                              </p>
                            </>
                          )}
                        </div>
                        {pct != null && (
                          <div className="space-y-1">
                            <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${progressColor} transition-all`}
                                style={{
                                  width: `${Math.min(pct, 100)}%`,
                                }}
                              />
                            </div>
                            <p
                              className={`text-[10px] font-medium text-center ${
                                isBad ? "text-red-600" : "text-green-600"
                              }`}
                            >
                              {pct.toFixed(0)}% av{" "}
                              {mc.type === "min" ? "mål" : "grense"}
                              {isBad
                                ? mc.type === "min"
                                  ? " — Under"
                                  : " — Over"
                                : " — OK"}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* ── 3. Active Alerts ── */}
            {empAlerts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Aktive varsler ({empAlerts.length})
                </h3>
                <div className="space-y-2">
                  {empAlerts
                    .sort((a, b) => {
                      const o: Record<string, number> = { critical: 0, warning: 1, info: 2 };
                      return (o[a.severity] ?? 3) - (o[b.severity] ?? 3);
                    })
                    .map((alert, i) => {
                      const isRate =
                        alert.metric.includes("rate") ||
                        alert.metric.includes("percent");
                      const unit = isRate ? "%" : " dører/dag";
                      const sBorder = {
                        critical: "border-l-red-500",
                        warning: "border-l-orange-500",
                        info: "border-l-blue-500",
                      }[alert.severity];
                      const sIcon = {
                        critical: (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ),
                        warning: (
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                        ),
                        info: (
                          <Info className="h-4 w-4 text-blue-500" />
                        ),
                      }[alert.severity];

                      return (
                        <Card
                          key={`${alert.type}-${i}`}
                          className={`border-l-4 ${sBorder}`}
                        >
                          <CardContent className="p-3 flex items-center gap-3">
                            {sIcon}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {alert.type.replace(/_/g, " ")}
                                {alert.consecutive_days
                                  ? ` (${alert.consecutive_days} dager)`
                                  : ""}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Nåværende: {alert.value.toFixed(1)}
                                {unit} &bull; Terskel: {alert.threshold}
                                {unit}
                              </p>
                            </div>
                            <MiniTrendBars
                              dailyDetails={alert.daily_details}
                              threshold={alert.threshold}
                              height={28}
                            />
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </div>
            )}

            {/* ── 4. Daily Performance Chart ── */}
            {dailyChartData.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Daglig ytelse
                </h3>
                <Card>
                  <CardContent className="p-4">
                    <ChartContainer
                      config={{
                        doors: {
                          label: "Dører",
                          color: "hsl(221, 83%, 53%)",
                        },
                      }}
                      className="h-[220px] w-full"
                    >
                      <BarChart
                        data={dailyChartData}
                        margin={{
                          top: 5,
                          right: 10,
                          left: 0,
                          bottom: 0,
                        }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10 }}
                          interval="preserveStartEnd"
                        />
                        <YAxis tick={{ fontSize: 10 }} width={35} />
                        <ChartTooltip
                          content={<ChartTooltipContent />}
                        />
                        {doorThreshold != null && (
                          <ReferenceLine
                            y={doorThreshold}
                            stroke="hsl(0, 84%, 60%)"
                            strokeDasharray="4 4"
                            label={{
                              value: `Terskel: ${doorThreshold}`,
                              position: "insideTopRight",
                              fontSize: 10,
                              fill: "hsl(0, 84%, 60%)",
                            }}
                          />
                        )}
                        <Bar
                          dataKey="doors"
                          fill="hsl(221, 83%, 53%)"
                          radius={[3, 3, 0, 0]}
                        />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── 5. Daily Breakdown Table ── */}
            {longestDD.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Daglig oversikt (Siste {longestDD.length} dager)
                </h3>
                <Card>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="text-xs h-8 pl-4">
                            Dato
                          </TableHead>
                          <TableHead className="text-xs h-8 text-right">
                            Dører
                          </TableHead>
                          <TableHead className="text-xs h-8 text-right">
                            Ja
                          </TableHead>
                          <TableHead className="text-xs h-8 text-right">
                            Ja-prosent
                          </TableHead>
                          <TableHead className="text-xs h-8 text-center pr-4">
                            Status
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {longestDD.map((day, idx) => {
                          const fmtDate = new Date(
                            day.date,
                          ).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          });
                          const isBad =
                            day.below_doors_threshold ||
                            day.below_yes_rate_threshold;
                          return (
                            <TableRow
                              key={idx}
                              className={
                                isBad
                                  ? "bg-red-50/60"
                                  : "hover:bg-muted/30"
                              }
                            >
                              <TableCell className="py-2 pl-4 text-xs font-medium">
                                {fmtDate}
                              </TableCell>
                              <TableCell
                                className={`py-2 text-xs text-right tabular-nums ${
                                  day.below_doors_threshold
                                    ? "text-red-600 font-bold"
                                    : ""
                                }`}
                              >
                                {day.doors}
                              </TableCell>
                              <TableCell className="py-2 text-xs text-right tabular-nums">
                                {day.ja}
                              </TableCell>
                              <TableCell
                                className={`py-2 text-xs text-right tabular-nums ${
                                  day.below_yes_rate_threshold
                                    ? "text-red-600 font-bold"
                                    : ""
                                }`}
                              >
                                {day.yes_rate.toFixed(1)}%
                              </TableCell>
                              <TableCell className="py-2 text-center pr-4">
                                {isBad ? (
                                  <Badge
                                    variant="destructive"
                                    className="text-[10px] h-5 px-1.5"
                                  >
                                    Under
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] h-5 px-1.5 text-green-600 border-green-200"
                                  >
                                    OK
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Summary row */}
                  <div className="border-t px-4 py-2.5 flex items-center justify-between bg-muted/30">
                    <span className="text-xs text-muted-foreground">
                      {longestDD.length} dager vist
                    </span>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        Gj.sn. dører:{" "}
                        <strong className="text-foreground">
                          {(
                            longestDD.reduce((s, d) => s + d.doors, 0) /
                            longestDD.length
                          ).toFixed(1)}
                        </strong>
                      </span>
                      <span>
                        Gj.sn. ja-prosent:{" "}
                        <strong className="text-foreground">
                          {(
                            longestDD.reduce(
                              (s, d) => s + d.yes_rate,
                              0,
                            ) / longestDD.length
                          ).toFixed(1)}
                          %
                        </strong>
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* ── 6. Threshold Comparison ── */}
            <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Terskel sammenligning
                </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {metricCards
                  .filter((mc) => mc.threshold != null)
                  .map((mc) => {
                    const pct =
                      mc.threshold! > 0
                        ? (mc.current / mc.threshold!) * 100
                        : 0;
                    const gap = mc.current - mc.threshold!;
                    const gapPct =
                      mc.threshold! > 0
                        ? ((mc.current - mc.threshold!) / mc.threshold!) * 100
                        : 0;
                    const isBad =
                      mc.type === "min"
                        ? mc.current < mc.threshold!
                        : mc.current > mc.threshold!;
                    const gaugeColor = isBad
                      ? "text-red-500"
                      : "text-green-500";

                    return (
                      <Card key={mc.title} className="border text-center">
                        <CardContent className="p-4 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            {mc.title}
                          </p>

                          {/* Circular gauge visual */}
                          <div className="relative mx-auto w-20 h-20">
                            <svg
                              viewBox="0 0 36 36"
                              className="w-full h-full -rotate-90"
                            >
                              <path
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="#e5e7eb"
                                strokeWidth="3"
                              />
                              <path
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke={
                                  isBad
                                    ? "hsl(0, 84%, 60%)"
                                    : "hsl(142, 71%, 45%)"
                                }
                                strokeWidth="3"
                                strokeDasharray={`${Math.min(
                                  pct,
                                  100,
                                )}, 100`}
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span
                                className={`text-sm font-bold ${gaugeColor}`}
                              >
                                {Math.min(pct, 999).toFixed(0)}%
                              </span>
                            </div>
                          </div>

                          <p className="text-xs tabular-nums text-muted-foreground">
                            {mc.current.toFixed(1)}
                            {mc.unit} / {mc.threshold}
                            {mc.unit}
                          </p>
                          <p
                            className={`text-xs font-semibold ${
                              isBad ? "text-red-600" : "text-green-600"
                            }`}
                          >
                            {gapPct > 0 ? "+" : ""}
                            {gapPct.toFixed(0)}% gap
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>

            {/* ── 7. Response Summary ── */}
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Responsfordeling
                </h3>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    {
                      label: "Ja",
                      value: emp.ja,
                      pct: emp.yes_rate,
                      color: "text-green-600",
                    },
                    {
                      label: "Nei",
                      value: emp.nei,
                      pct: emp.no_rate,
                      color: "text-red-600",
                    },
                    {
                      label: "Ikke hjemme",
                      value: emp.ikke_hjemme,
                      pct: emp.not_home_rate,
                      color: "text-gray-600",
                    },
                    {
                      label: "Følg opp",
                      value: emp.folg_opp,
                      pct: emp.follow_up_rate,
                      color: "text-blue-600",
                    },
                  ].map((item) => (
                    <div key={item.label} className="text-center">
                      <p className="text-xs text-muted-foreground">
                        {item.label}
                      </p>
                      <p className={`text-lg font-bold ${item.color}`}>
                        {item.value}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.pct.toFixed(1)}%
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        {/* ── Footer ── */}
        <div className="border-t px-6 py-3 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-normal">
              ID: {emp.employee_id}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Lukk
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Full Alerts Overview (dedicated tab)
// ---------------------------------------------------------------------------
//
// NOTE: Varsler tab uses initials avatars by design — mascots add noise to
// alert triage. Do NOT introduce SmartAvatar / MoodMascot here, in
// AlertCardDetailed, or in AlertDetailDialog. See ROLLOUT_LOG.md Phase 1.5.
// ---------------------------------------------------------------------------

function AlertsOverview({
  alerts: rawAlerts,
  campaigns,
  employees,
}: {
  alerts: Alert[];
  campaigns: Campaign[];
  employees: EmployeeAnalytics[];
}) {
  // ── Sub-tab state ──
  const [alertsSubTab, setAlertsSubTab] = useState<
    "all" | "employee" | "type"
  >("all");

  // ── Phase 5: Filter state ──
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");

  // ── Phase 6: Pagination state ──
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

  // ── Phase 8: Employee Stats dialog ──
  const [statsEmployeeId, setStatsEmployeeId] = useState<string | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);

  // ── Detail dialog state ──
  const [detailAlert, setDetailAlert] = useState<Alert | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // ── Phase 9: Dismissed alerts ──
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [markingAllReviewed, setMarkingAllReviewed] = useState(false);

  // Apply dismiss filter
  const alerts = useMemo(
    () =>
      rawAlerts.filter(
        (a) =>
          !dismissedIds.has(`${a.employee_id || ""}-${a.type || ""}-${a.metric || ""}`),
      ),
    [rawAlerts, dismissedIds],
  );

  // ── Phase 7: Expand/collapse state for grouped views ──
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(),
  );
  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ── Severity counts (always on unfiltered) ──
  const criticalCount = useMemo(
    () => alerts.filter((a) => a.severity === "critical").length,
    [alerts],
  );
  const warningCount = useMemo(
    () => alerts.filter((a) => a.severity === "warning").length,
    [alerts],
  );
  const infoCount = useMemo(
    () => alerts.filter((a) => a.severity === "info").length,
    [alerts],
  );
  const totalCount = alerts.length;

  // ── Phase 5: Build a campaign lookup for employee→campaign mapping ──
  // Note: Alerts don't carry a campaign_id, but since the preview API
  // already filters by campaign at the request level, the campaign filter
  // here is informational. We still keep it so users can narrow by name
  // if there are multiple campaigns in the response.

  // Helper: check if any filter is active
  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    severityFilter !== "all" ||
    campaignFilter !== "all";

  // ── Phase 5: Filtered alerts (search + severity + campaign) ──
  const filteredAlerts = useMemo(() => {
    let result = [...alerts];

    // Fuzzy-ish search: matches employee name, alert type, message, metric, employee_id
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          (a.employee_name || "").toLowerCase().includes(q) ||
          (a.type || "").replace(/_/g, " ").toLowerCase().includes(q) ||
          (a.message || "").toLowerCase().includes(q) ||
          (a.metric || "").replace(/_/g, " ").toLowerCase().includes(q) ||
          (a.employee_id || "").toLowerCase().includes(q),
      );
    }

    // Severity filter
    if (severityFilter !== "all") {
      result = result.filter((a) => a.severity === severityFilter);
    }

    // Sort: critical → warning → info
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    result.sort(
      (a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3),
    );

    return result;
  }, [alerts, searchQuery, severityFilter]);

  // ── Phase 5: Grouped views ──
  const alertsByEmployee = useMemo(() => {
    const groups: Record<string, Alert[]> = {};
    filteredAlerts.forEach((a) => {
      const name = a.employee_name || "Ukjent";
      if (!groups[name]) groups[name] = [];
      groups[name].push(a);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredAlerts]);

  const alertsByType = useMemo(() => {
    const groups: Record<string, Alert[]> = {};
    filteredAlerts.forEach((a) => {
      const typeName = (a.type || "unknown").replace(/_/g, " ");
      if (!groups[typeName]) groups[typeName] = [];
      groups[typeName].push(a);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredAlerts]);

  // ── Phase 6: Pagination ──
  const totalPages = Math.ceil(filteredAlerts.length / pageSize);
  const paginatedAlerts = useMemo(
    () =>
      filteredAlerts.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize,
      ),
    [filteredAlerts, currentPage, pageSize],
  );

  // Reset page when filters or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, severityFilter, campaignFilter, alertsSubTab, pageSize]);

  // ── Phase 5: Clear all filters ──
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setSeverityFilter("all");
    setCampaignFilter("all");
  }, []);

  // ── Phase 9: Handlers ──
  const handleViewDetails = useCallback((alert: Alert) => {
    setDetailAlert(alert);
    setDetailOpen(true);
  }, []);

  // Open Employee Stats modal (Phase 8)
  const handleOpenEmployeeStats = useCallback((employeeId: string) => {
    setStatsEmployeeId(employeeId);
    setStatsOpen(true);
  }, []);

  // Dismiss single alert (Phase 9 — optimistic, client-side only)
  const handleDismiss = useCallback((alert: Alert) => {
    const id = `${alert.employee_id || ""}-${alert.type || ""}-${alert.metric || ""}`;
    setDismissedIds((prev) => new Set(prev).add(id));
  }, []);

  // Mark all visible alerts as reviewed (Phase 9)
  const handleMarkAllReviewed = useCallback(async () => {
    setMarkingAllReviewed(true);
    await new Promise((r) => setTimeout(r, 400));
    const newIds = new Set(dismissedIds);
    filteredAlerts.forEach((a) =>
      newIds.add(`${a.employee_id || ""}-${a.type || ""}-${a.metric || ""}`),
    );
    setDismissedIds(newIds);
    setMarkingAllReviewed(false);
  }, [filteredAlerts, dismissedIds]);

  // ── Empty state ──
  if (!alerts || alerts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold tracking-tight">
              Varseloversikt
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Sanntids ytelsesovervåking og avviksdeteksjon
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AlertSeverityCard
            severity="critical"
            count={0}
            description="Umiddelbar handling påkrevd"
          />
          <AlertSeverityCard
            severity="warning"
            count={0}
            description="Nærmer seg terskler"
          />
          <AlertSeverityCard
            severity="info"
            count={0}
            description="Systemvarsler"
          />
          <AlertSeverityCard
            severity="total"
            count={0}
            description="Aktive varsler på plattformen"
          />
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
            <h3 className="text-lg font-semibold">Alt klart!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Ingen aktive varsler. Alle mål er innenfor terskler.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Title Section ──────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold tracking-tight">Varseloversikt</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Sanntids ytelsesovervåking og avviksdeteksjon
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2"
          disabled={markingAllReviewed || filteredAlerts.length === 0}
          onClick={handleMarkAllReviewed}
        >
          {markingAllReviewed ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCheck className="h-4 w-4" />
          )}
          {markingAllReviewed ? "Markerer..." : "Merk alle som gjennomgått"}
        </Button>
      </div>

      {/* ── Summary Cards (Phase 2) ────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AlertSeverityCard
          severity="critical"
          count={criticalCount}
          description="Umiddelbar handling påkrevd"
        />
        <AlertSeverityCard
          severity="warning"
          count={warningCount}
          description="Nærmer seg terskler"
        />
        <AlertSeverityCard
          severity="info"
          count={infoCount}
          description="Systemvarsler"
        />
        <AlertSeverityCard
          severity="total"
          count={totalCount}
          description="Aktive varsler på plattformen"
        />
      </div>

      {/* ── Sub-Tabs + Filters (Phase 5) ─────────────────── */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Row 1: Sub-tabs + filter count */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* Sub-tabs */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              {(
                [
                  { key: "all", label: "Alle varsler" },
                  { key: "employee", label: "Etter ansatt" },
                  { key: "type", label: "Etter type" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    alertsSubTab === tab.key
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setAlertsSubTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Filtered count badge */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs font-normal gap-1">
                  <Search className="h-3 w-3" />
                  {filteredAlerts.length} av {totalCount} varsler
                </Badge>
              </div>
            )}
          </div>

          {/* Row 2: Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-[300px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Søk navn, type, mål..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Severity filter */}
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="h-9 w-[140px] text-sm">
                <SelectValue placeholder="Alvorlighetsgrad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alvorlighetsgrad: Alle</SelectItem>
                <SelectItem value="critical">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    Kritisk
                  </span>
                </SelectItem>
                <SelectItem value="warning">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-orange-500" />
                    Advarsel
                  </span>
                </SelectItem>
                <SelectItem value="info">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    Info
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Campaign filter (informational — data is already filtered at API level) */}
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="h-9 w-[180px] text-sm">
                <SelectValue placeholder="Kampanje" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Kampanje: Alle</SelectItem>
                {campaigns.map((camp) => (
                  <SelectItem key={camp.id} value={camp.id}>
                    {camp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear all filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <XCircle className="h-3.5 w-3.5" />
                Nullstill filtre
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Alert List (All Alerts tab) ────────────────── */}
      {alertsSubTab === "all" && (
        <div className="space-y-3">
          {paginatedAlerts.length > 0 ? (
            paginatedAlerts.map((alert, i) => (
              <AlertCardDetailed
                key={`${alert.employee_id}-${alert.type}-${i}`}
                alert={alert}
                onViewDetails={() => handleViewDetails(alert)}
                onDismiss={() => handleDismiss(alert)}
              />
            ))
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-14">
                <Search className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <h4 className="text-sm font-semibold">Ingen matchende varsler</h4>
                <p className="text-sm text-muted-foreground mt-1 text-center max-w-xs">
                  Ingen varsler matcher dine nåværende filtre. Prøv å justere
                  søkeordet eller endre alvorlighetsgradsfiltret.
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="mt-3 gap-1.5 text-xs"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Nullstill alle filtre
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── By Employee view (Phase 7 — collapsible groups) ── */}
      {alertsSubTab === "employee" && (
        <div className="space-y-3">
          {alertsByEmployee.length > 0 ? (
            alertsByEmployee.map(([name, empAlerts]) => {
              const isExpanded = expandedGroups.has(`emp-${name}`);
              const worstSeverity = empAlerts.some(
                (a) => a.severity === "critical",
              )
                ? "critical"
                : empAlerts.some((a) => a.severity === "warning")
                ? "warning"
                : "info";
              const borderColor = {
                critical: "border-l-red-500",
                warning: "border-l-orange-500",
                info: "border-l-blue-500",
              }[worstSeverity];

              return (
                <Card
                  key={name}
                  className={`border-l-4 ${borderColor} overflow-hidden transition-shadow hover:shadow-md`}
                >
                  {/* Clickable header row */}
                  <button
                    onClick={() => toggleGroup(`emp-${name}`)}
                    className="w-full text-left"
                  >
                    <CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600 ring-1 ring-gray-200">
                            {name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div>
                            <CardTitle className="text-sm">
                              {name}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {empAlerts.length} aktiv{empAlerts.length !== 1 ? "e" : ""} varsel{empAlerts.length !== 1 ? "er" : ""}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Severity badges */}
                          <div className="flex items-center gap-1.5">
                            {empAlerts.some(
                              (a) => a.severity === "critical",
                            ) && (
                              <Badge
                                variant="destructive"
                                className="text-xs"
                              >
                                {
                                  empAlerts.filter(
                                    (a) => a.severity === "critical",
                                  ).length
                                }{" "}
                                kritisk
                              </Badge>
                            )}
                            {empAlerts.some(
                              (a) => a.severity === "warning",
                            ) && (
                              <Badge className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                                {
                                  empAlerts.filter(
                                    (a) => a.severity === "warning",
                                  ).length
                                }{" "}
                                advarsel
                              </Badge>
                            )}
                            {empAlerts.some(
                              (a) => a.severity === "info",
                            ) && (
                              <Badge className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                                {
                                  empAlerts.filter(
                                    (a) => a.severity === "info",
                                  ).length
                                }{" "}
                                info
                              </Badge>
                            )}
                          </div>
                          {/* View Stats + Expand toggle */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-blue-600 hover:text-blue-700 px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEmployeeStats(empAlerts[0].employee_id);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Statistikk
                          </Button>
                          <div className="h-7 w-7 flex items-center justify-center">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </button>

                  {/* Collapsible body */}
                  {isExpanded && (
                    <CardContent className="space-y-2 pb-4 pt-1 px-4 animate-in slide-in-from-top-1 duration-200">
                      {empAlerts.map((alert, j) => (
                        <AlertCardDetailed
                          key={`${alert.employee_id}-${alert.type}-${j}`}
                          alert={alert}
                          onViewDetails={() => handleViewDetails(alert)}
                          onDismiss={() => handleDismiss(alert)}
                        />
                      ))}
                    </CardContent>
                  )}
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-14">
                <Users className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <h4 className="text-sm font-semibold">Ingen matchende ansatte</h4>
                <p className="text-sm text-muted-foreground mt-1 text-center max-w-xs">
                  Ingen ansatte med varsler matcher dine nåværende filtre.
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="mt-3 gap-1.5 text-xs"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Nullstill alle filtre
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── By Type view (Phase 7 — collapsible groups) ── */}
      {alertsSubTab === "type" && (
        <div className="space-y-3">
          {alertsByType.length > 0 ? (
            alertsByType.map(([typeName, typeAlerts]) => {
              const isExpanded = expandedGroups.has(`type-${typeName}`);
              const worstSeverity = typeAlerts.some(
                (a) => a.severity === "critical",
              )
                ? "critical"
                : typeAlerts.some((a) => a.severity === "warning")
                ? "warning"
                : "info";
              const typeIcon = {
                critical: (
                  <XCircle className="h-4 w-4 text-red-500" />
                ),
                warning: (
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                ),
                info: (
                  <Info className="h-4 w-4 text-blue-500" />
                ),
              }[worstSeverity];

              return (
                <Card
                  key={typeName}
                  className="overflow-hidden transition-shadow hover:shadow-md"
                >
                  <button
                    onClick={() => toggleGroup(`type-${typeName}`)}
                    className="w-full text-left"
                  >
                    <CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                            {typeIcon}
                          </div>
                          <div>
                            <CardTitle className="text-sm capitalize">
                              {typeName}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {typeAlerts.length} varsel{typeAlerts.length !== 1 ? "er" : ""} &bull;{" "}
                              {new Set(typeAlerts.map((a) => a.employee_name || "Ukjent"))
                                .size}{" "}
                              ansatte berørt
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            {typeAlerts.some(
                              (a) => a.severity === "critical",
                            ) && (
                              <Badge
                                variant="destructive"
                                className="text-xs"
                              >
                                {
                                  typeAlerts.filter(
                                    (a) => a.severity === "critical",
                                  ).length
                                }{" "}
                                kritisk
                              </Badge>
                            )}
                            {typeAlerts.some(
                              (a) => a.severity === "warning",
                            ) && (
                              <Badge className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                                {
                                  typeAlerts.filter(
                                    (a) => a.severity === "warning",
                                  ).length
                                }{" "}
                                advarsel
                              </Badge>
                            )}
                            {typeAlerts.some(
                              (a) => a.severity === "info",
                            ) && (
                              <Badge className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                                {
                                  typeAlerts.filter(
                                    (a) => a.severity === "info",
                                  ).length
                                }{" "}
                                info
                              </Badge>
                            )}
                          </div>
                          <div className="h-7 w-7 flex items-center justify-center">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </button>

                  {isExpanded && (
                    <CardContent className="space-y-2 pb-4 pt-1 px-4 animate-in slide-in-from-top-1 duration-200">
                      {typeAlerts.map((alert, j) => (
                        <AlertCardDetailed
                          key={`${alert.employee_id}-${alert.type}-${j}`}
                          alert={alert}
                          onViewDetails={() => handleViewDetails(alert)}
                          onDismiss={() => handleDismiss(alert)}
                        />
                      ))}
                    </CardContent>
                  )}
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-14">
                <AlertCircle className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <h4 className="text-sm font-semibold">Ingen matchende varseltyper</h4>
                <p className="text-sm text-muted-foreground mt-1 text-center max-w-xs">
                  Ingen varseltyper matcher dine nåværende filtre.
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="mt-3 gap-1.5 text-xs"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Nullstill alle filtre
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Pagination (Phase 6) ──────────────────────────── */}
      {alertsSubTab === "all" && filteredAlerts.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Left: showing count */}
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>
                  Viser{" "}
                  <span className="font-medium text-foreground">
                    {(currentPage - 1) * pageSize + 1}–
                    {Math.min(currentPage * pageSize, filteredAlerts.length)}
                  </span>{" "}
                  av{" "}
                  <span className="font-medium text-foreground">
                    {filteredAlerts.length}
                  </span>{" "}
                  varsler
                  {hasActiveFilters && (
                    <span className="text-muted-foreground">
                      {" "}(filtrert fra {totalCount})
                    </span>
                  )}
                </span>

                {/* Page size selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">Vis</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => setPageSize(Number(v))}
                  >
                    <SelectTrigger className="h-7 w-[60px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs">per side</span>
                </div>
              </div>

              {/* Right: nav buttons */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  {/* First page */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage <= 1}
                    title="Første side"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <ChevronLeft className="h-4 w-4 -ml-2.5" />
                  </Button>
                  {/* Previous */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    title="Forrige side"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {/* Page indicators */}
                  <div className="flex items-center gap-1 mx-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let page: number;
                      if (totalPages <= 5) {
                        page = i + 1;
                      } else if (currentPage <= 3) {
                        page = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        page = totalPages - 4 + i;
                      } else {
                        page = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`h-8 w-8 text-xs rounded-md font-medium transition-colors ${
                            page === currentPage
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>

                  {/* Next */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage >= totalPages}
                    title="Neste side"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  {/* Last page */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage >= totalPages}
                    title="Siste side"
                  >
                    <ChevronRight className="h-4 w-4" />
                    <ChevronRight className="h-4 w-4 -ml-2.5" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Alert Detail Dialog (Phase 3) ───────────────── */}
      <AlertDetailDialog
        alert={detailAlert}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onViewEmployeeStats={handleOpenEmployeeStats}
      />

      {/* ── Employee Stats Modal (Phase 8) ──────────────── */}
      <EmployeeStatsModal
        employeeId={statsEmployeeId}
        open={statsOpen}
        onOpenChange={setStatsOpen}
        alerts={alerts}
        employees={employees}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components: Work Time
// ---------------------------------------------------------------------------

function WorkTimeMiniPanel({ summary }: { summary: WorkTimeSummary }) {
  const items = [
    {
      label: "Ansatte aktive",
      value: `${summary.employees.active_count} / ${summary.employees.total}`,
      sub: `${summary.employees.active_pct.toFixed(0)}% aktive`,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      icon: Users,
    },
    {
      label: "Sjefer aktive",
      value: `${summary.managers.active_count} / ${summary.managers.total}`,
      sub: `${summary.managers.active_pct.toFixed(0)}% aktive`,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      icon: UserCircle,
    },
    {
      label: "Snitt per dag",
      value: formatSeconds(summary.combined.avg_daily_seconds),
      sub: `${summary.combined.active_count} av ${summary.combined.total} aktive`,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      icon: Clock,
    },
  ];
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Arbeidstid – oversikt</CardTitle>
          <Badge variant="outline" className="ml-auto text-xs">
            {summary.period_days} dager
          </Badge>
        </div>
        <CardDescription>
          Aktiv terskel: {Math.floor(summary.active_threshold_seconds / 60)} min tilkoblet
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/40"
              >
                <div className={`p-2 rounded-lg ${item.iconBg}`}>
                  <Icon className={`h-4 w-4 ${item.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{item.label}</p>
                  <p className="text-lg font-bold leading-tight">{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.sub}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function WorkTimePersonTable({
  title,
  people,
  emptyLabel,
}: {
  title: string;
  people: WorkTimePersonEntry[];
  emptyLabel: string;
}) {
  const [search, setSearch] = useState("");
  const sorted = useMemo(
    () => [...people].sort((a, b) => b.total_seconds - a.total_seconds),
    [people],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) => p.name.toLowerCase().includes(q));
  }, [sorted, search]);
  const searchActive = search.trim().length > 0;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          {searchActive
            ? `${filtered.length} av ${people.length} ${people.length === 1 ? "person" : "personer"}`
            : `${people.length} ${people.length === 1 ? "person" : "personer"}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {sorted.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">{emptyLabel}</div>
        ) : (
          <>
            <div className="px-4 pb-3 sm:px-6">
              <div className="relative">
                <Search
                  className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  aria-hidden
                />
                <Input
                  type="search"
                  placeholder="Søk etter navn…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-9"
                  aria-label={`Søk i ${title}`}
                />
              </div>
            </div>
            {filtered.length === 0 ? (
              <div className="px-4 pb-6 sm:px-6 text-center text-sm text-muted-foreground border-t pt-4">
                Ingen treff for «{search.trim()}».
              </div>
            ) : (
              <div
                className="max-h-[min(24rem,50vh)] overflow-y-auto overflow-x-auto border-t"
                style={{ WebkitOverflowScrolling: "touch" as const }}
              >
                <div className="relative w-full min-w-0">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky top-0 z-[1] bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
                          Navn
                        </TableHead>
                        <TableHead className="sticky top-0 z-[1] bg-card text-right shadow-[0_1px_0_0_hsl(var(--border))]">
                          Total tid
                        </TableHead>
                        <TableHead className="sticky top-0 z-[1] bg-card text-right shadow-[0_1px_0_0_hsl(var(--border))]">
                          Snitt per dag
                        </TableHead>
                        <TableHead className="sticky top-0 z-[1] bg-card text-center shadow-[0_1px_0_0_hsl(var(--border))]">
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((person) => (
                        <TableRow key={person.id}>
                          <TableCell className="font-medium">{person.name}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatSeconds(person.total_seconds)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatSeconds(person.avg_daily_seconds)}
                          </TableCell>
                          <TableCell className="text-center">
                            {person.is_active ? (
                              <Badge
                                variant="outline"
                                className="bg-green-50 text-green-700 border-green-200 text-xs"
                              >
                                Aktiv
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-muted text-muted-foreground text-xs"
                              >
                                Inaktiv
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function WorkTimeBarChart({ employees }: { employees: WorkTimePersonEntry[] }) {
  const chartData = useMemo(
    () =>
      [...employees]
        .sort((a, b) => b.avg_daily_minutes - a.avg_daily_minutes)
        .slice(0, 15)
        .map((e) => ({
          name: e.name.split(" ")[0],
          avg_daily_minutes: Math.round(e.avg_daily_minutes),
        })),
    [employees],
  );
  if (!chartData.length) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Arbeidstid per ansatt</CardTitle>
        <CardDescription>Gjennomsnittlig daglig arbeidstid i minutter</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={workTimeBarConfig} className="h-[280px] w-full">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}m`}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="avg_daily_minutes"
              fill="var(--color-avg_daily_minutes)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Chart configs
// ---------------------------------------------------------------------------

const dailyTrendConfig: ChartConfig = {
  total_doors: { label: "Totale dører", color: "hsl(221, 83%, 53%)" },
  ja: { label: "Ja", color: "hsl(142, 71%, 45%)" },
  yes_rate: { label: "Ja-prosent %", color: "hsl(262, 83%, 58%)" },
};

const hourlyConfig: ChartConfig = {
  total_doors: { label: "Totale dører", color: "hsl(221, 83%, 53%)" },
  ja: { label: "Ja", color: "hsl(142, 71%, 45%)" },
  yes_rate: { label: "Ja-prosent %", color: "hsl(262, 83%, 58%)" },
};

const statusPieConfig: ChartConfig = {
  ja: { label: "Ja", color: "hsl(142, 71%, 45%)" },
  nei: { label: "Nei", color: "hsl(0, 84%, 60%)" },
  ikke_hjemme: { label: "Ikke hjemme", color: "hsl(45, 93%, 47%)" },
  folg_opp: { label: "Følg opp", color: "hsl(221, 83%, 53%)" },
};

const workTimeBarConfig: ChartConfig = {
  avg_daily_minutes: { label: "Snitt per dag (min)", color: "hsl(221, 83%, 53%)" },
};

const STATUS_COLORS = [
  "hsl(142, 71%, 45%)", // ja – green
  "hsl(0, 84%, 60%)",   // nei – red
  "hsl(45, 93%, 47%)",  // ikke hjemme – yellow
  "hsl(221, 83%, 53%)", // følg opp – blue
];

// ---------------------------------------------------------------------------
// Sub-component: Daily Trend Chart (Area + Line)
// ---------------------------------------------------------------------------

function DailyTrendChart({ data }: { data: DailyBreakdown[] }) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        // Format date for display (e.g. "Feb 10")
        label: new Date(d.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      })),
    [data],
  );

  if (!chartData.length) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Daglig trend</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
          Ingen daglige data tilgjengelig for denne perioden.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Daglig trend</CardTitle>
        <CardDescription>Dører banket og ja-prosent over tid</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={dailyTrendConfig} className="h-[280px] w-full">
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradDoors" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradJa" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="fill-muted-foreground"
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="fill-muted-foreground"
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
              className="fill-muted-foreground"
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="total_doors"
              stroke="var(--color-total_doors)"
              fill="url(#gradDoors)"
              strokeWidth={2}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="ja"
              stroke="var(--color-ja)"
              fill="url(#gradJa)"
              strokeWidth={2}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="yes_rate"
              stroke="var(--color-yes_rate)"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 5"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Hourly Activity Chart (Bar)
// ---------------------------------------------------------------------------

function HourlyActivityChart({ data }: { data: HourlyBreakdown[] }) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: `${String(d.hour).padStart(2, "0")}:00`,
      })),
    [data],
  );

  if (!chartData.length) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Timeaktivitet</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
          Ingen timebaserte data tilgjengelig for denne perioden.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Timeaktivitet</CardTitle>
        <CardDescription>Dørbanking-volum per time på dagen</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={hourlyConfig} className="h-[280px] w-full">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              className="fill-muted-foreground"
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="fill-muted-foreground"
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
              className="fill-muted-foreground"
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar yAxisId="left" dataKey="total_doors" fill="var(--color-total_doors)" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="left" dataKey="ja" fill="var(--color-ja)" radius={[4, 4, 0, 0]} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="yes_rate"
              stroke="var(--color-yes_rate)"
              strokeWidth={2}
              dot={false}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Status Distribution Pie Chart
// ---------------------------------------------------------------------------

function StatusPieChart({ summary }: { summary: AnalyticsSummary }) {
  const pieData = useMemo(
    () => [
      { name: "ja", value: summary.ja, fill: STATUS_COLORS[0] },
      { name: "nei", value: summary.nei, fill: STATUS_COLORS[1] },
      { name: "ikke_hjemme", value: summary.ikke_hjemme, fill: STATUS_COLORS[2] },
      { name: "folg_opp", value: summary.folg_opp, fill: STATUS_COLORS[3] },
    ],
    [summary],
  );

  const total = summary.total_doors || 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Statusfordeling</CardTitle>
        <CardDescription>Proporsjonal oversikt over resultater</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={statusPieConfig} className="mx-auto h-[250px] w-full max-w-[300px]">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              strokeWidth={2}
              stroke="hsl(var(--background))"
            >
              {pieData.map((entry, i) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            {/* Center label */}
            <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-2xl font-bold">
              {summary.total_doors.toLocaleString()}
            </text>
            <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-xs">
              totale dører
            </text>
          </PieChart>
        </ChartContainer>

        {/* Legend row */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          {pieData.map((item) => (
            <div key={item.name} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.fill }} />
              <span className="text-muted-foreground capitalize">
                {statusPieConfig[item.name]?.label}
              </span>
              <span className="ml-auto font-medium tabular-nums">
                {((item.value / total) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

type SortDir = "asc" | "desc";

function SortableHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: string;
  currentKey: string;
  currentDir: SortDir;
  onSort: (key: string) => void;
}) {
  const isActive = currentKey === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-1 hover:text-foreground transition-colors -ml-1 px-1"
    >
      {label}
      {isActive ? (
        currentDir === "asc" ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

function useSort<T>(data: T[], defaultKey: keyof T & string, defaultDir: SortDir = "desc") {
  const [sortKey, setSortKey] = useState<string>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const toggle = useCallback(
    (key: string) => {
      if (key === sortKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
    },
    [sortKey],
  );

  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey];
      const bVal = (b as Record<string, unknown>)[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal ?? "");
      const bStr = String(bVal ?? "");
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
    return copy;
  }, [data, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, toggle };
}

// ---------------------------------------------------------------------------
// Sub-component: Campaign Breakdown Table
// ---------------------------------------------------------------------------

function CampaignBreakdownTable({ campaigns }: { campaigns: CampaignAnalytics[] }) {
  const { sorted, sortKey, sortDir, toggle } = useSort(campaigns, "total_doors");

  if (!campaigns.length) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Kampanjeoversikt</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[150px] text-sm text-muted-foreground">
          Ingen kampanjedata tilgjengelig for denne perioden.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Kampanjeoversikt</CardTitle>
            <CardDescription>Ytelsesmål per kampanje</CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">
            {campaigns.length} kampanjer
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 min-w-[160px]">
                  <SortableHeader label="Kampanje" sortKey="campaign_name" currentKey={sortKey} currentDir={sortDir} onSort={toggle} />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader label="Dører" sortKey="total_doors" currentKey={sortKey} currentDir={sortDir} onSort={toggle} />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader label="Ja %" sortKey="yes_rate" currentKey={sortKey} currentDir={sortDir} onSort={toggle} />
                </TableHead>
                <TableHead className="text-right hidden sm:table-cell">
                  <SortableHeader label="Nei %" sortKey="no_rate" currentKey={sortKey} currentDir={sortDir} onSort={toggle} />
                </TableHead>
                <TableHead className="text-right hidden md:table-cell">
                  <SortableHeader label="Kontakt %" sortKey="contact_rate" currentKey={sortKey} currentDir={sortDir} onSort={toggle} />
                </TableHead>
                <TableHead className="text-right hidden lg:table-cell">
                  <SortableHeader label="Ansatte" sortKey="num_employees" currentKey={sortKey} currentDir={sortDir} onSort={toggle} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((c) => (
                <TableRow key={c.campaign_id}>
                  <TableCell className="pl-6 font-medium">{c.campaign_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.total_doors.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className={c.yes_rate >= 10 ? "text-green-600" : c.yes_rate >= 5 ? "text-yellow-600" : "text-red-600"}>
                      {c.yes_rate.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums hidden sm:table-cell">{c.no_rate.toFixed(1)}%</TableCell>
                  <TableCell className="text-right tabular-nums hidden md:table-cell">{c.contact_rate.toFixed(1)}%</TableCell>
                  <TableCell className="text-right tabular-nums hidden lg:table-cell">{c.num_employees}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Employee Leaderboard
// ---------------------------------------------------------------------------

/** Rank badge for top 3 */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-yellow-100 text-yellow-700">
        <Trophy className="h-3.5 w-3.5" />
      </span>
    );
  if (rank === 2)
    return (
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 text-gray-500">
        <Medal className="h-3.5 w-3.5" />
      </span>
    );
  if (rank === 3)
    return (
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-orange-100 text-orange-600">
        <Medal className="h-3.5 w-3.5" />
      </span>
    );
  return (
    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted text-muted-foreground text-xs font-medium">
      {rank}
    </span>
  );
}

/** Small consistency bar */
function ConsistencyBar({ score }: { score: number }) {
  const pct = Math.min(Math.max(score, 0), 100);
  const color =
    pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

function EmployeeLeaderboard({
  employees,
  topPerformers,
}: {
  employees: EmployeeAnalytics[];
  topPerformers?: TopPerformers;
}) {
  const { sorted, sortKey, sortDir, toggle } = useSort(employees, "total_doors");

  if (!employees.length) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ansattranking</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[150px] text-sm text-muted-foreground">
          Ingen ansattdata tilgjengelig for denne perioden.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Ansattranking</CardTitle>
            <CardDescription>Rangert etter nåværende sortering — topp 3 fremhevet</CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">
            {employees.length} ansatte
          </Badge>
        </div>
      </CardHeader>

      {/* Top performer badges row */}
      {topPerformers && (
        <CardContent className="pb-3 pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded-lg border border-ab-success/25 bg-ab-success/[0.08] p-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-ab-fg-3 mb-0.5">Topp Ja %</p>
              <div className="flex justify-center mb-1.5">
                <SmartAvatar
                  size="md"
                  user={{ id: topPerformers.top_yes_rate.employee_id, name: topPerformers.top_yes_rate.employee_name, user_type: "employee" }}
                  performance={{ jaProsent: topPerformers.top_yes_rate.value, dorerPerDag: DEFAULT_MIN_DORER_PER_DAG * 1.5, rankPercentile: 5 }}
                  showMoodIndicator
                />
              </div>
              <p className="text-sm font-semibold text-ab-success truncate">{topPerformers.top_yes_rate.employee_name}</p>
              <p className="text-xs text-ab-success">{topPerformers.top_yes_rate.value.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border border-ab-accent/25 bg-ab-accent/[0.08] p-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-ab-fg-3 mb-0.5">Topp dører</p>
              <div className="flex justify-center mb-1.5">
                <SmartAvatar
                  size="md"
                  user={{ id: topPerformers.top_doors.employee_id, name: topPerformers.top_doors.employee_name, user_type: "employee" }}
                  performance={{ jaProsent: DEFAULT_MIN_JA_PROSENT * 1.6, dorerPerDag: topPerformers.top_doors.value, rankPercentile: 5 }}
                  showMoodIndicator
                />
              </div>
              <p className="text-sm font-semibold text-ab-accent truncate">{topPerformers.top_doors.employee_name}</p>
              <p className="text-xs text-ab-accent">{topPerformers.top_doors.value.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-ab-danger/25 bg-ab-danger/[0.08] p-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-ab-fg-3 mb-0.5">Lavest Ja %</p>
              <div className="flex justify-center mb-1.5">
                <SmartAvatar
                  size="md"
                  user={{ id: topPerformers.bottom_yes_rate.employee_id, name: topPerformers.bottom_yes_rate.employee_name, user_type: "employee" }}
                  performance={{ jaProsent: topPerformers.bottom_yes_rate.value, dorerPerDag: DEFAULT_MIN_DORER_PER_DAG * 0.6 }}
                  showMoodIndicator
                />
              </div>
              <p className="text-sm font-semibold text-ab-danger truncate">{topPerformers.bottom_yes_rate.employee_name}</p>
              <p className="text-xs text-ab-danger">{topPerformers.bottom_yes_rate.value.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border border-ab-warning/25 bg-ab-warning/[0.08] p-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-ab-fg-3 mb-0.5">Lavest dører</p>
              <div className="flex justify-center mb-1.5">
                <SmartAvatar
                  size="md"
                  user={{ id: topPerformers.bottom_doors.employee_id, name: topPerformers.bottom_doors.employee_name, user_type: "employee" }}
                  performance={{ jaProsent: DEFAULT_MIN_JA_PROSENT * 0.4, dorerPerDag: topPerformers.bottom_doors.value }}
                  showMoodIndicator
                />
              </div>
              <p className="text-sm font-semibold text-ab-warning truncate">{topPerformers.bottom_doors.employee_name}</p>
              <p className="text-xs text-ab-warning">{topPerformers.bottom_doors.value.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      )}

      <CardContent className="px-0 pb-0 pt-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 w-[48px]">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                </TableHead>
                <TableHead className="min-w-[140px]">
                  <SortableHeader label="Ansatt" sortKey="employee_name" currentKey={sortKey} currentDir={sortDir} onSort={toggle} />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader label="Dører" sortKey="total_doors" currentKey={sortKey} currentDir={sortDir} onSort={toggle} />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader label="Dører/dag" sortKey="doors_per_day" currentKey={sortKey} currentDir={sortDir} onSort={toggle} />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader label="Ja %" sortKey="yes_rate" currentKey={sortKey} currentDir={sortDir} onSort={toggle} />
                </TableHead>
                <TableHead className="text-right hidden sm:table-cell">
                  <SortableHeader label="Kontakt %" sortKey="contact_rate" currentKey={sortKey} currentDir={sortDir} onSort={toggle} />
                </TableHead>
                <TableHead className="text-right hidden md:table-cell min-w-[120px]">
                  <SortableHeader label="Konsistens" sortKey="consistency_score" currentKey={sortKey} currentDir={sortDir} onSort={toggle} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((emp, idx) => {
                const rank = idx + 1;
                const isTop3 = rank <= 3;
                const percentile = sorted.length > 0
                  ? Math.round((rank / sorted.length) * 100)
                  : undefined;
                return (
                  <TableRow
                    key={emp.employee_id}
                    className={isTop3 ? "bg-primary/[0.03]" : undefined}
                  >
                    <TableCell className="pl-6">
                      <RankBadge rank={rank} />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <SmartAvatar
                          size="sm"
                          user={{ id: emp.employee_id, name: emp.employee_name, user_type: "employee" }}
                          performance={{
                            jaProsent: emp.yes_rate,
                            dorerPerDag: emp.doors_per_day,
                            rankPercentile: percentile,
                          }}
                          showMoodIndicator
                        />
                        <span className="truncate">{emp.employee_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {emp.total_doors.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {emp.doors_per_day.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={
                          emp.yes_rate >= 10
                            ? "text-green-600 font-medium"
                            : emp.yes_rate >= 5
                            ? "text-yellow-600"
                            : "text-red-600"
                        }
                      >
                        {emp.yes_rate.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums hidden sm:table-cell">
                      {emp.contact_rate.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell">
                      <ConsistencyBar score={emp.consistency_score} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Threshold helpers
// ---------------------------------------------------------------------------

/** Safely format a number to 1 decimal place, handling null/undefined/string */
function formatPercent(value: number | string | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (typeof num !== 'number' || isNaN(num)) return '0.0';
  return num.toFixed(1);
}

/** Safely format a number to 0 decimal places */
function formatNumber(value: number | string | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (typeof num !== 'number' || isNaN(num)) return '0';
  return num.toString();
}

const SCOPE_OPTIONS: { value: ThresholdScope; label: string; icon: typeof Globe }[] = [
  { value: "global", label: "Global", icon: Globe },
  { value: "manager", label: "Leder", icon: Shield },
  { value: "campaign", label: "Kampanje", icon: Building2 },
  { value: "employee", label: "Ansatt", icon: UserCircle },
];

const THRESHOLD_FIELDS: {
  key: keyof CreateThresholdData;
  label: string;
  hint: string;
  step?: string;
  min?: number;
  max?: number;
}[] = [
  { key: "min_doors_per_day", label: "Min dører / dag", hint: "Minimum dører banket per dag", min: 0 },
  { key: "min_doors_per_week", label: "Min dører / uke", hint: "Minimum dører banket per uke", min: 0 },
  { key: "min_yes_rate_percent", label: "Min ja-prosent %", hint: "Minimum akseptabel ja-prosent", min: 0, max: 100, step: "0.1" },
  { key: "max_no_rate_percent", label: "Maks nei-prosent %", hint: "Maksimum akseptabel nei-prosent", min: 0, max: 100, step: "0.1" },
  { key: "min_contact_rate_percent", label: "Min kontaktprosent %", hint: "Minimum kontaktprosent påkrevd", min: 0, max: 100, step: "0.1" },
  { key: "consecutive_days_threshold", label: "Påfølgende dager", hint: "Dager under terskel før varsel", min: 1 },
  { key: "performance_drop_alert_percent", label: "Nedgangsvarsel %", hint: "Prosentvis nedgang som utløser varsel", min: 0, max: 100, step: "0.1" },
  { key: "max_inactive_hours", label: "Maks inaktive timer", hint: "Timer inaktiv før varsel", min: 0, step: "0.5" },
];

const emptyFormData = (): CreateThresholdData => ({
  scope: "global",
  min_doors_per_day: 0,
  min_doors_per_week: 0,
  min_yes_rate_percent: 0,
  max_no_rate_percent: 100,
  min_contact_rate_percent: 0,
  consecutive_days_threshold: 3,
  performance_drop_alert_percent: 20,
  max_inactive_hours: 4,
  is_active: true,
});

function thresholdToForm(t: Threshold): CreateThresholdData {
  return {
    scope: t.scope,
    manager: t.manager ?? undefined,
    campaign: t.campaign ?? undefined,
    employee: t.employee ?? undefined,
    min_doors_per_day: t.min_doors_per_day,
    min_doors_per_week: t.min_doors_per_week,
    min_yes_rate_percent: t.min_yes_rate_percent,
    max_no_rate_percent: t.max_no_rate_percent,
    min_contact_rate_percent: t.min_contact_rate_percent,
    consecutive_days_threshold: t.consecutive_days_threshold,
    performance_drop_alert_percent: t.performance_drop_alert_percent,
    max_inactive_hours: t.max_inactive_hours,
    is_active: t.is_active,
  };
}

// ---------------------------------------------------------------------------
// Sub-component: Threshold Add / Edit Dialog
// ---------------------------------------------------------------------------

function ThresholdFormDialog({
  open,
  onOpenChange,
  editing,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Threshold | null;
  onSave: (data: CreateThresholdData) => Promise<void>;
  saving: boolean;
}) {
  const [form, setForm] = useState<CreateThresholdData>(emptyFormData());
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [managers, setManagers] = useState<AssignableUser[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Fetch dropdown options when dialog opens
  useEffect(() => {
    if (open) {
      setLoadingOptions(true);
      Promise.all([
        fetchAllCampaigns().catch(() => []),
        fetchManagersAndAdmins().catch(() => []),
        fetchEmployees().catch(() => []),
      ]).then(([campaignsData, managersData, employeesData]) => {
        setCampaigns(campaignsData);
        setManagers(managersData);
        setEmployees(employeesData);
      }).finally(() => setLoadingOptions(false));
    }
  }, [open]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setForm(editing ? thresholdToForm(editing) : emptyFormData());
    }
  }, [open, editing]);

  // Helper to fetch employees
  async function fetchEmployees(): Promise<Array<{ id: string; name: string }>> {
    try {
      const token = authService.getAccessToken();
      if (!token) return [];
      const url = buildApiUrl(API_CONFIG.EMPLOYEES.LIST);
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader(),
        },
      });
      if (!response.ok) return [];
      const data = await response.json();
      const list = Array.isArray(data) ? data : (data.results || []);
      return list.map((emp: any) => ({
        id: emp.id,
        name: emp.name || emp.username || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email || 'Ukjent',
      }));
    } catch {
      return [];
    }
  }

  const updateField = useCallback(
    (key: keyof CreateThresholdData, value: unknown) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await onSave(form);
    },
    [form, onSave],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Rediger terskel" : "Opprett terskel"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Oppdater ytelsesterskelverdiene nedenfor."
              : "Konfigurer en ny ytelsesterskel for overvåking."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Scope selector */}
          <div className="space-y-2">
            <Label>Omfang</Label>
            <Select
              value={form.scope}
              onValueChange={(v) => updateField("scope", v as ThresholdScope)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map((opt) => {
                  const ScopeIcon = opt.icon;
                  return (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="inline-flex items-center gap-2">
                        <ScopeIcon className="h-3.5 w-3.5" />
                        {opt.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Scope-specific target selector */}
          {form.scope === "manager" && (
            <div className="space-y-2">
              <Label>Leder</Label>
              <Select
                value={form.manager ?? ""}
                onValueChange={(value) => updateField("manager", value || undefined)}
                disabled={loadingOptions}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={loadingOptions ? "Laster ledere..." : "Velg en leder"} />
                </SelectTrigger>
                <SelectContent>
                  {managers.length === 0 && !loadingOptions ? (
                    <SelectItem value="" disabled>Ingen ledere tilgjengelig</SelectItem>
                  ) : (
                    managers.map((mgr) => (
                      <SelectItem key={mgr.id} value={mgr.id}>
                        {mgr.name || mgr.username || mgr.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
          {form.scope === "campaign" && (
            <div className="space-y-2">
              <Label>Kampanje</Label>
              <Select
                value={form.campaign ?? ""}
                onValueChange={(value) => updateField("campaign", value || undefined)}
                disabled={loadingOptions}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={loadingOptions ? "Laster kampanjer..." : "Velg en kampanje"} />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.length === 0 && !loadingOptions ? (
                    <SelectItem value="" disabled>Ingen kampanjer tilgjengelig</SelectItem>
                  ) : (
                    campaigns.map((camp) => (
                      <SelectItem key={camp.id} value={camp.id}>
                        {camp.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
          {form.scope === "employee" && (
            <div className="space-y-2">
              <Label>Ansatt</Label>
              <Select
                value={form.employee ?? ""}
                onValueChange={(value) => updateField("employee", value || undefined)}
                disabled={loadingOptions}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={loadingOptions ? "Laster ansatte..." : "Velg en ansatt"} />
                </SelectTrigger>
                <SelectContent>
                  {employees.length === 0 && !loadingOptions ? (
                    <SelectItem value="" disabled>Ingen ansatte tilgjengelig</SelectItem>
                  ) : (
                    employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Numeric fields grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {THRESHOLD_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-xs">{field.label}</Label>
                <Input
                  type="number"
                  step={field.step ?? "1"}
                  min={field.min}
                  max={field.max}
                  value={(form as Record<string, unknown>)[field.key] as number ?? 0}
                  onChange={(e) => updateField(field.key, parseFloat(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
                <p className="text-[10px] text-muted-foreground leading-tight">{field.hint}</p>
              </div>
            ))}
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Aktiv</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Aktiver eller deaktiver denne terskelen</p>
            </div>
            <Switch
              checked={form.is_active ?? true}
              onCheckedChange={(checked) => updateField("is_active", checked)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Avbryt
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editing ? "Lagre endringer" : "Opprett terskel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Delete Confirmation Dialog
// ---------------------------------------------------------------------------

function DeleteThresholdDialog({
  open,
  onOpenChange,
  threshold,
  onConfirm,
  deleting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threshold: Threshold | null;
  onConfirm: () => Promise<void>;
  deleting: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Slett terskel</DialogTitle>
          <DialogDescription>
            Er du sikker på at du vil slette{" "}
            <span className="font-medium text-foreground">{threshold?.scope_display}</span>{" "}
            terskelen{threshold?.target_name ? ` for "${threshold.target_name}"` : ""}? Denne handlingen
            kan ikke angres.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Avbryt
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting}>
            {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Slett
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Scope badge
// ---------------------------------------------------------------------------

function ScopeBadge({ scope }: { scope: ThresholdScope }) {
  const opt = SCOPE_OPTIONS.find((o) => o.value === scope);
  const ScopeIcon = opt?.icon ?? Globe;
  const colors: Record<ThresholdScope, string> = {
    global: "bg-purple-100 text-purple-700 border-purple-200",
    manager: "bg-blue-100 text-blue-700 border-blue-200",
    campaign: "bg-green-100 text-green-700 border-green-200",
    employee: "bg-orange-100 text-orange-700 border-orange-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${colors[scope]}`}>
      <ScopeIcon className="h-3 w-3" />
      {opt?.label ?? scope}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: ThresholdManager (full CRUD)
// ---------------------------------------------------------------------------

function ThresholdManager({
  thresholds: rawThresholds,
  loading,
  error,
  onFetch,
  onCreate,
  onUpdate,
  onDelete,
}: {
  thresholds: Threshold[];
  loading: boolean;
  error: string | null;
  onFetch: () => void;
  onCreate: (data: CreateThresholdData) => Promise<Threshold | null>;
  onUpdate: (id: string, data: Partial<CreateThresholdData>) => Promise<Threshold | null>;
  onDelete: (id: string) => Promise<boolean>;
}) {
  // Defensive: ensure thresholds is always an array
  const thresholds = Array.isArray(rawThresholds) ? rawThresholds : [];

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingThreshold, setEditingThreshold] = useState<Threshold | null>(null);
  const [deletingThreshold, setDeletingThreshold] = useState<Threshold | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch on mount
  useEffect(() => {
    onFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handlers
  const handleAdd = useCallback(() => {
    setEditingThreshold(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((t: Threshold) => {
    setEditingThreshold(t);
    setFormOpen(true);
  }, []);

  const handleDeleteClick = useCallback((t: Threshold) => {
    setDeletingThreshold(t);
    setDeleteOpen(true);
  }, []);

  const handleSave = useCallback(
    async (data: CreateThresholdData) => {
      setSaving(true);
      try {
        if (editingThreshold) {
          await onUpdate(editingThreshold.id, data);
        } else {
          await onCreate(data);
        }
        setFormOpen(false);
      } finally {
        setSaving(false);
      }
    },
    [editingThreshold, onCreate, onUpdate],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingThreshold) return;
    setDeleting(true);
    try {
      await onDelete(deletingThreshold.id);
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }, [deletingThreshold, onDelete]);

  return (
    <>
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Terskelkonfigurasjon</CardTitle>
              <CardDescription>Definer ytelsesgrenser og varselutløsere</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onFetch} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
              <Button size="sm" onClick={handleAdd}>
                <Plus className="mr-2 h-4 w-4" />
                Legg til terskel
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Error */}
        {error && (
          <CardContent className="pt-0 pb-3">
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          </CardContent>
        )}

        {/* List */}
        <CardContent className="px-0 pb-0">
          {loading && thresholds.length === 0 ? (
            <div className="space-y-3 px-6 pb-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-6 w-20 rounded-md" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              ))}
            </div>
          ) : thresholds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <Activity className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-sm font-semibold">Ingen terskler konfigurert</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Opprett din første terskel for å begynne å overvåke ansattes ytelse og motta varsler.
              </p>
              <Button size="sm" className="mt-4" onClick={handleAdd}>
                <Plus className="mr-2 h-4 w-4" />
                Opprett terskel
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Omfang</TableHead>
                    <TableHead>Mål</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Min dører/dag</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Min ja %</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">Maks nei %</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Status</TableHead>
                    <TableHead className="text-right pr-6 w-[100px]">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {thresholds.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="pl-6">
                        <ScopeBadge scope={t.scope} />
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-sm">{t.target_name || "—"}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums hidden sm:table-cell">
                        {formatNumber(t.min_doors_per_day)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums hidden md:table-cell">
                        {formatPercent(t.min_yes_rate_percent)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums hidden lg:table-cell">
                        {formatPercent(t.max_no_rate_percent)}%
                      </TableCell>
                      <TableCell className="text-center hidden sm:table-cell">
                        <Badge variant={t.is_active ? "default" : "secondary"} className="text-xs">
                          {t.is_active ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(t)}
                            title="Rediger terskel"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteClick(t)}
                            title="Slett terskel"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Threshold detail cards (expanded view) */}
      {thresholds.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {thresholds.map((t) => (
            <Card key={`detail-${t.id}`} className={!t.is_active ? "opacity-60" : undefined}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <ScopeBadge scope={t.scope} />
                  <Badge variant={t.is_active ? "default" : "secondary"} className="text-xs">
                    {t.is_active ? "Aktiv" : "Inaktiv"}
                  </Badge>
                </div>
                <CardTitle className="text-sm mt-2">{t.target_name || "Global standard"}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Dører/dag</span>
                    <p className="font-semibold tabular-nums">{formatNumber(t.min_doors_per_day)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dører/uke</span>
                    <p className="font-semibold tabular-nums">{formatNumber(t.min_doors_per_week)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Min ja %</span>
                    <p className="font-semibold tabular-nums">{formatPercent(t.min_yes_rate_percent)}%</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Maks nei %</span>
                    <p className="font-semibold tabular-nums">{formatPercent(t.max_no_rate_percent)}%</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Kontakt %</span>
                    <p className="font-semibold tabular-nums">{formatPercent(t.min_contact_rate_percent)}%</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Påfølg. dager</span>
                    <p className="font-semibold tabular-nums">{formatNumber(t.consecutive_days_threshold)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Nedgangsvarsel</span>
                    <p className="font-semibold tabular-nums">{formatPercent(t.performance_drop_alert_percent)}%</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Inaktive timer</span>
                    <p className="font-semibold tabular-nums">{formatNumber(t.max_inactive_hours)}t</p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleEdit(t)}>
                    <Pencil className="mr-1.5 h-3 w-3" />
                    Rediger
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => handleDeleteClick(t)}
                  >
                    <Trash2 className="mr-1.5 h-3 w-3" />
                    Slett
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <ThresholdFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editingThreshold}
        onSave={handleSave}
        saving={saving}
      />
      <DeleteThresholdDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        threshold={deletingThreshold}
        onConfirm={handleConfirmDelete}
        deleting={deleting}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Quick-info row (period + employees)
// ---------------------------------------------------------------------------

function PeriodInfo({
  data,
}: {
  data: AnalyticsPreviewResponse;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <Calendar className="h-3 w-3" />
        {data.period.start_date} — {data.period.end_date} ({data.period.days} dager)
      </span>
      <span className="inline-flex items-center gap-1">
        <Users className="h-3 w-3" />
        {data.summary.unique_employees} ansatte
      </span>
      <span className="inline-flex items-center gap-1">
        <BarChart3 className="h-3 w-3" />
        Gj.sn. {data.summary.avg_doors_per_employee.toFixed(1)} dører/ansatt
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Email Report Dialog
// ---------------------------------------------------------------------------

function EmailReportDialog({
  open,
  onOpenChange,
  onSend,
  isSending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (emails: string[]) => void;
  isSending: boolean;
}) {
  const [emails, setEmails] = useState<string[]>(["atavelgiro@absystem.no"]);
  const [newEmail, setNewEmail] = useState("");

  // Reset emails when dialog opens
  useEffect(() => {
    if (open) {
      setEmails(["atavelgiro@absystem.no"]);
      setNewEmail("");
    }
  }, [open]);

  const handleAddEmail = () => {
    const trimmed = newEmail.trim();
    if (trimmed && !emails.includes(trimmed)) {
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(trimmed)) {
        setEmails([...emails, trimmed]);
        setNewEmail("");
      }
    }
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setEmails(emails.filter((email) => email !== emailToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddEmail();
    }
  };

  const handleSend = () => {
    if (emails.length > 0) {
      onSend(emails);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send ukentlig rapport</DialogTitle>
          <DialogDescription>
            Velg e-postadresser som skal motta den ukentlige rapporten.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Email list */}
          <div className="space-y-2">
            <Label>Mottakere</Label>
            <div className="flex flex-wrap gap-2 min-h-[60px] p-3 border rounded-md bg-muted/30">
              {emails.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ingen e-postadresser lagt til</p>
              ) : (
                emails.map((email) => (
                  <Badge
                    key={email}
                    variant="secondary"
                    className="flex items-center gap-1.5 px-2.5 py-1"
                  >
                    <Mail className="h-3 w-3" />
                    <span className="text-xs">{email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveEmail(email)}
                      className="ml-1 hover:text-destructive focus:outline-none"
                      disabled={isSending}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
          </div>

          {/* Add email input */}
          <div className="space-y-2">
            <Label>Legg til e-postadresse</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="navn@eksempel.no"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isSending}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddEmail}
                disabled={isSending || !newEmail.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || emails.length === 0}
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sender...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send rapport
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  MAIN PAGE COMPONENT                                                    ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export default function AnalyticsPage() {
  const { isSuperuser, isAuthenticated, isLoading, isCheckingSuperuser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ---- Tab routing (?tab=...) ----
  const VALID_TABS = ["overview", "performance", "thresholds", "alerts", "arbeidstid"] as const;
  type TabId = (typeof VALID_TABS)[number];
  const initialTab: TabId = (() => {
    const raw = searchParams?.get("tab");
    return (VALID_TABS as readonly string[]).includes(raw ?? "")
      ? (raw as TabId)
      : "overview";
  })();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const handleTabChange = useCallback(
    (next: string) => {
      const tabId = (VALID_TABS as readonly string[]).includes(next)
        ? (next as TabId)
        : "overview";
      setActiveTab(tabId);
      try {
        const sp = new URLSearchParams(Array.from(searchParams?.entries() ?? []));
        if (tabId === "overview") sp.delete("tab");
        else sp.set("tab", tabId);
        const q = sp.toString();
        router.replace(`/analytics${q ? `?${q}` : ""}`);
      } catch {
        /* SSR no-op */
      }
    },
    [router, searchParams],
  );

  // ---- Date range state ----
  const [startDate, setStartDate] = useState(daysAgoISO(7));
  const [endDate, setEndDate] = useState(todayISO());
  const [datePreset, setDatePreset] = useState("7"); // key for Select

  // ---- Campaign filter state ----
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all");

  // ---- Email report dialog state ----
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  // ---- Hooks ----
  const preview = useAnalyticsPreview();
  const reports = useAnalyticsReports();
  const thresholdsHook = useAnalyticsThresholds();
  const workTimeStats = useWorkTimeStats();

  // ---- Fetch campaigns on mount ----
  useEffect(() => {
    if (isSuperuser && isAuthenticated) {
      fetchAllCampaigns()
        .then(setCampaigns)
        .catch((err) => {
          console.error('[Analytics] Failed to fetch campaigns:', err);
          setCampaigns([]);
        });
    }
  }, [isSuperuser, isAuthenticated]);

  // ---- Auto-fetch when date range or campaign changes ----
  const fetchData = useCallback(() => {
    preview.fetchPreview({
      start_date: startDate,
      end_date: endDate,
      campaign_ids: selectedCampaignId && selectedCampaignId !== "all" ? [selectedCampaignId] : undefined,
    });
    workTimeStats.fetchWorkTimeStats({
      start_date: startDate,
      end_date: endDate,
      campaign_ids: selectedCampaignId && selectedCampaignId !== "all" ? [selectedCampaignId] : undefined,
    });
  }, [startDate, endDate, selectedCampaignId, preview.fetchPreview, workTimeStats.fetchWorkTimeStats]);

  useEffect(() => {
    if (isSuperuser && isAuthenticated) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, selectedCampaignId, isSuperuser, isAuthenticated]);

  // ---- Preset handler ----
  const handlePresetChange = useCallback(
    (value: string) => {
      setDatePreset(value);
      if (value === "custom") return; // user will adjust inputs
      const days = parseInt(value, 10);
      setStartDate(daysAgoISO(days));
      setEndDate(todayISO());
    },
    [],
  );

  // ---- Download handler ----
  const handleDownload = useCallback(() => {
    reports.downloadReport({
      start_date: startDate,
      end_date: endDate,
      campaign_ids: selectedCampaignId && selectedCampaignId !== "all" ? [selectedCampaignId] : undefined,
    });
  }, [startDate, endDate, selectedCampaignId, reports.downloadReport]);

  // ---- Trigger handler ----
  const handleTrigger = useCallback(() => {
    setEmailDialogOpen(true);
  }, []);

  // ---- Send report handler ----
  const handleSendReport = useCallback(
    (emails: string[]) => {
      reports.triggerReport(emails).then((result) => {
        if (result) {
          // Only close dialog on success
          setEmailDialogOpen(false);
        }
        // On error, dialog stays open so user can retry
      });
    },
    [reports.triggerReport]
  );

  // ---- Auth redirect ----
  useEffect(() => {
    if (!isLoading && !isCheckingSuperuser) {
      if (!isAuthenticated) {
        router.push("/login");
      } else if (!isSuperuser) {
        router.push("/");
      }
    }
  }, [isLoading, isCheckingSuperuser, isAuthenticated, isSuperuser, router]);

  // ---- Loading gate ----
  if (isLoading || isCheckingSuperuser || !isAuthenticated || !isSuperuser) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-muted/40">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-2 text-sm text-muted-foreground">Laster analytikk...</p>
        </div>
      </div>
    );
  }

  // ---- Derived state ----
  const { data, loading: previewLoading, error: previewError } = preview;

  return (
    <ProtectedRoute requiredUserType="manager">
      <ClientLayout>
        <div className="relative flex min-h-screen flex-col bg-ab-base bg-page-glow">
          {/* Atmosphere — matches Statistikk / Rapport / Oppgaver / Områder / Kampanjer */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.035] dark:opacity-[0.06]"
            style={{
              maskImage: "linear-gradient(to bottom, black, transparent 70%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, black, transparent 70%)",
            }}
          />

          <div className="relative z-10 flex flex-col flex-1 min-h-screen">
            <PageHeader
              eyebrow="ANALYSE · INNSIKT"
              title="Analytikkdashbord"
              description="Omfattende ytelsesmål og innsikt for salgsteamet ditt."
              action={
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    disabled={reports.downloading || !data}
                  >
                    {reports.downloading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Last ned PDF
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleTrigger}
                    disabled={reports.triggering}
                  >
                    {reports.triggering ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Send ukentlig rapport
                  </Button>
                </div>
              }
            />

          <div className="flex-1 space-y-6 p-3 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">


            {/* ── Email Report Dialog ────────────────────────────────────── */}
            <EmailReportDialog
              open={emailDialogOpen}
              onOpenChange={setEmailDialogOpen}
              onSend={handleSendReport}
              isSending={reports.triggering}
            />

            {/* ── Filters Row — card-premium with non-default accent dots ── */}
            <div className="card-premium p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                {/* Preset selector */}
                <div className="w-full sm:w-[180px]">
                  <label className="text-[10px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold block mb-1.5 inline-flex items-center gap-1">
                    {datePreset !== "7" && (
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ab-accent" />
                    )}
                    Datoområde
                  </label>
                  <Select value={datePreset} onValueChange={handlePresetChange}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Velg område" />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_PRESETS.map((p) => (
                        <SelectItem key={p.days} value={String(p.days)}>
                          {p.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Egendefinert område</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Campaign filter */}
                <div className="w-full sm:w-[200px]">
                  <label className="text-[10px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold block mb-1.5 inline-flex items-center gap-1">
                    {selectedCampaignId !== "all" && (
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ab-accent" />
                    )}
                    Kampanje
                  </label>
                  <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Alle kampanjer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle kampanjer</SelectItem>
                      {campaigns.map((camp) => (
                        <SelectItem key={camp.id} value={camp.id}>
                          {camp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Start date */}
                <div className="w-full sm:w-auto">
                  <label className="text-[10px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold block mb-1.5">
                    Startdato
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDatePreset("custom");
                    }}
                    className="h-9 text-sm w-full sm:w-[150px]"
                  />
                </div>

                {/* End date */}
                <div className="w-full sm:w-auto">
                  <label className="text-[10px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold block mb-1.5">
                    Sluttdato
                  </label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDatePreset("custom");
                    }}
                    className="h-9 text-sm w-full sm:w-[150px]"
                  />
                </div>

                {/* Refresh button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 mt-auto"
                  onClick={fetchData}
                  disabled={previewLoading}
                  aria-label="Oppdater"
                >
                  {previewLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* ── Report action feedback ─────────────────────────── */}
            {reports.error && (
              <ErrorBanner message={reports.error} onRetry={reports.clearError} />
            )}
            {reports.triggerResult && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="flex items-center gap-3 p-4">
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  <p className="text-sm text-green-800">
                    Rapport sendt! Periode: {reports.triggerResult.period.start_date} til{" "}
                    {reports.triggerResult.period.end_date} — {reports.triggerResult.summary.total_doors} dører,{" "}
                    {reports.triggerResult.summary.alerts_count} varsler.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* ── Preview error ──────────────────────────────────── */}
            {previewError && (
              <ErrorBanner message={previewError} onRetry={fetchData} />
            )}

            {/* ── Period info ────────────────────────────────────── */}
            {data && !previewLoading && <PeriodInfo data={data} />}

            {/* ── Tabs ───────────────────────────────────────────── */}
            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
              <TabsList className="h-auto p-0 bg-transparent border-b border-ab-line rounded-none w-full justify-start gap-0">
                <TabsTrigger
                  value="overview"
                  className="gap-1.5 h-10 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-ab-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-ab-fg data-[state=active]:font-semibold text-[13px] font-medium text-ab-fg-3 hover:text-ab-fg transition-colors duration-120"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Oversikt</span>
                </TabsTrigger>
                <TabsTrigger
                  value="performance"
                  className="gap-1.5 h-10 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-ab-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-ab-fg data-[state=active]:font-semibold text-[13px] font-medium text-ab-fg-3 hover:text-ab-fg transition-colors duration-120"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Ytelse</span>
                </TabsTrigger>
                <TabsTrigger
                  value="thresholds"
                  className="gap-1.5 h-10 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-ab-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-ab-fg data-[state=active]:font-semibold text-[13px] font-medium text-ab-fg-3 hover:text-ab-fg transition-colors duration-120"
                >
                  <Activity className="h-4 w-4" />
                  <span className="hidden sm:inline">Terskler</span>
                </TabsTrigger>
                <TabsTrigger
                  value="alerts"
                  className="gap-1.5 h-10 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-ab-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-ab-fg data-[state=active]:font-semibold text-[13px] font-medium text-ab-fg-3 hover:text-ab-fg transition-colors duration-120 relative"
                >
                  <Bell className="h-4 w-4" />
                  <span className="hidden sm:inline">Varsler</span>
                  {data && data.alerts && data.alerts.length > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center h-5 px-1.5 rounded-full bg-ab-danger text-white text-[11px] font-medium tabular leading-none">
                      {data.alerts.length > 99 ? "99+" : data.alerts.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="arbeidstid"
                  className="gap-1.5 h-10 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-ab-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-ab-fg data-[state=active]:font-semibold text-[13px] font-medium text-ab-fg-3 hover:text-ab-fg transition-colors duration-120"
                >
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">Arbeidstid</span>
                </TabsTrigger>
              </TabsList>

              {/* ───── Overview Tab ───── */}
              <TabsContent value="overview" className="space-y-4">
                {previewLoading ? (
                  <>
                    <SummaryCardsSkeleton />
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-2">
                        <ChartSkeleton />
                      </div>
                      <ChartSkeleton />
                    </div>
                    <ChartSkeleton />
                  </>
                ) : data ? (
                  <>
                    {/* Row 1: Summary metric cards */}
                    <SummaryCards
                      summary={data.summary}
                      comparisons={data.comparisons}
                    />

                    {/* Row 2: Status stacked bar + Pie chart side by side */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-2">
                        <StatusBreakdown summary={data.summary} />
                      </div>
                      <StatusPieChart summary={data.summary} />
                    </div>

                    {/* Row 2b: Talkmore "Nei-årsaker" (only when Talkmore data is in scope) */}
                    {(() => {
                      const talkmoreCampaigns = data.campaigns.filter((c) => c.is_talkmore);
                      if (talkmoreCampaigns.length === 0) return null;
                      const merged = mergeNeiBreakdowns(talkmoreCampaigns);
                      return (
                        <TalkmoreNeiBreakdownCard
                          breakdown={merged}
                          multipleCampaigns={
                            (!selectedCampaignId || selectedCampaignId === "all") &&
                            talkmoreCampaigns.length > 1
                          }
                        />
                      );
                    })()}

                    {/* Row 3: Daily trend (full width) */}
                    <DailyTrendChart data={data.daily_breakdown} />

                    {/* Row 4: Hourly chart + Alerts side by side */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-2">
                        <HourlyActivityChart data={data.hourly_breakdown} />
                      </div>
                      <AlertsPanel alerts={data.alerts} />
                    </div>

                    {/* Row 5: Work time summary (only if backend returns the field) */}
                    {data.work_time_summary && (
                      <WorkTimeMiniPanel summary={data.work_time_summary} />
                    )}
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
                    <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <h3 className="text-lg font-semibold">Ingen data ennå</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Velg et datoområde og klikk oppdater for å laste analytikk.
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* ───── Performance Tab ───── */}
              <TabsContent value="performance" className="space-y-6">
                {previewLoading ? (
                  <>
                    <TableSkeleton />
                    <TableSkeleton />
                  </>
                ) : data ? (
                  <>
                    <CampaignBreakdownTable campaigns={data.campaigns} />
                    <EmployeeLeaderboard
                      employees={data.employees}
                      topPerformers={data.top_performers}
                    />
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <h3 className="text-lg font-semibold">Ingen data ennå</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Last analytikkdata for å se ytelsesdetaljer.
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* ───── Thresholds Tab ───── */}
              <TabsContent value="thresholds" className="space-y-4">
                <ThresholdManager
                  thresholds={thresholdsHook.thresholds}
                  loading={thresholdsHook.loading}
                  error={thresholdsHook.error}
                  onFetch={thresholdsHook.fetchThresholds}
                  onCreate={thresholdsHook.createThreshold}
                  onUpdate={thresholdsHook.updateThreshold}
                  onDelete={thresholdsHook.deleteThreshold}
                />
              </TabsContent>

              {/* ───── Alerts Tab ───── */}
              <TabsContent value="alerts" className="space-y-4">
                {previewLoading ? (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {[1, 2, 3, 4].map((i) => (
                        <Card key={i}>
                          <CardContent className="p-5">
                            <Skeleton className="h-3 w-16 mb-3" />
                            <Skeleton className="h-8 w-12 mb-2" />
                            <Skeleton className="h-3 w-28" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-9 w-[240px]" />
                          <div className="flex-1" />
                          <Skeleton className="h-9 w-[200px]" />
                          <Skeleton className="h-9 w-[140px]" />
                        </div>
                      </CardContent>
                    </Card>
                    {[1, 2, 3].map((i) => (
                      <Card key={i}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            <Skeleton className="h-11 w-11 rounded-full" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-48" />
                            </div>
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-8 w-16" />
                            <Skeleton className="h-6 w-14" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </>
                ) : data ? (
                  <AlertsOverview
                    alerts={data.alerts}
                    campaigns={campaigns}
                    employees={data.employees || []}
                  />
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
                    <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <h3 className="text-lg font-semibold">Ingen data ennå</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Last analytikkdata for å se varsler og varsler.
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* ───── Arbeidstid Tab ───── */}
              <TabsContent value="arbeidstid" className="space-y-4">
                {workTimeStats.loading ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                      {[1, 2, 3].map((i) => (
                        <Card key={i}>
                          <CardContent className="p-5">
                            <Skeleton className="h-4 w-24 mb-3" />
                            <Skeleton className="h-8 w-20 mb-2" />
                            <Skeleton className="h-3 w-16" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-2">
                        <Skeleton className="h-64 w-full rounded-lg" />
                      </div>
                      <Skeleton className="h-64 w-full rounded-lg" />
                    </div>
                    <Skeleton className="h-[300px] w-full rounded-lg" />
                  </div>
                ) : workTimeStats.error ? (
                  <ErrorBanner
                    message={workTimeStats.error}
                    onRetry={() =>
                      workTimeStats.fetchWorkTimeStats({
                        start_date: startDate,
                        end_date: endDate,
                        campaign_ids: selectedCampaignId && selectedCampaignId !== "all" ? [selectedCampaignId] : undefined,
                      })
                    }
                  />
                ) : workTimeStats.data ? (
                  <>
                    {/* Row 1: 3 aggregate KPI cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                      {[
                        {
                          label: "Ansatte aktive",
                          value: `${workTimeStats.data.aggregate.employees.active_pct.toFixed(0)}%`,
                          sub: `${workTimeStats.data.aggregate.employees.active_count} av ${workTimeStats.data.aggregate.employees.total}`,
                          iconBg: "bg-blue-100",
                          iconColor: "text-blue-600",
                          icon: Users,
                        },
                        {
                          label: "Sjefer aktive",
                          value: `${workTimeStats.data.aggregate.managers.active_pct.toFixed(0)}%`,
                          sub: `${workTimeStats.data.aggregate.managers.active_count} av ${workTimeStats.data.aggregate.managers.total}`,
                          iconBg: "bg-purple-100",
                          iconColor: "text-purple-600",
                          icon: UserCircle,
                        },
                        {
                          label: "Snitt per dag (samlet)",
                          value: formatSeconds(workTimeStats.data.aggregate.combined.avg_daily_seconds),
                          sub: `${workTimeStats.data.aggregate.combined.active_count} av ${workTimeStats.data.aggregate.combined.total} aktive`,
                          iconBg: "bg-green-100",
                          iconColor: "text-green-600",
                          icon: Clock,
                        },
                      ].map((card) => {
                        const Icon = card.icon;
                        return (
                          <Card key={card.label} className="overflow-hidden">
                            <CardContent className="p-5">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <p className="text-xs sm:text-sm text-muted-foreground">
                                    {card.label}
                                  </p>
                                  <p className="text-xl sm:text-2xl font-bold">{card.value}</p>
                                  <p className="text-xs text-muted-foreground">{card.sub}</p>
                                </div>
                                <div className={`p-2.5 rounded-lg ${card.iconBg}`}>
                                  <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.iconColor}`} />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Row 2: Active threshold info banner */}
                    <Card className="bg-blue-50/50 border-blue-100">
                      <CardContent className="flex items-center gap-3 p-3">
                        <div className="p-2 rounded-lg bg-blue-100">
                          <Info className="h-4 w-4 text-blue-600" />
                        </div>
                        <p className="text-sm text-blue-800">
                          <span className="font-semibold">Aktiv terskel:</span> En bruker regnes
                          som aktiv hvis total tilkoblet tid overstiger{" "}
                          <span className="font-semibold">
                            {Math.floor(workTimeStats.data.active_threshold_seconds / 60)} minutter
                          </span>{" "}
                          i perioden. Periode: {workTimeStats.data.period.start_date} →{" "}
                          {workTimeStats.data.period.end_date} ({workTimeStats.data.period.days} dager).
                        </p>
                      </CardContent>
                    </Card>

                    {/* Row 3: Employees table (2/3) + Managers table (1/3) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-2">
                        <WorkTimePersonTable
                          title="Ansatte"
                          people={workTimeStats.data.employees}
                          emptyLabel="Ingen ansatte-data for denne perioden."
                        />
                      </div>
                      <WorkTimePersonTable
                        title="Sjefer"
                        people={workTimeStats.data.managers}
                        emptyLabel="Ingen sjef-data for denne perioden."
                      />
                    </div>

                    {/* Row 4: Bar chart – employee work time distribution */}
                    <WorkTimeBarChart employees={workTimeStats.data.employees} />
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <h3 className="text-lg font-semibold">Ingen arbeidstidsdata ennå</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Velg et datoområde og klikk oppdater for å laste arbeidstidsdata.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
          </div>
        </div>
      </ClientLayout>
    </ProtectedRoute>
  );
}

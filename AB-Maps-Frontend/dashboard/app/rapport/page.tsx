"use client"

import React, { useMemo, useState, useEffect, memo, useCallback, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import ClientLayout from "../ClientLayout";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { authService } from "@/lib/auth/authService";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "@/components/ui/use-toast";
import {
  Search,
  SearchX,
  ChevronDown,
  ChevronRight,
  Check,
  Download,
  FileText,
  X,
  Loader2,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, KPI, Sparkline } from "@/components/ui-ab";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
  ReferenceLine,
} from "recharts";

// --- COUNTUP — rAF-based, reduced-motion aware ---
function CountUp({
  value,
  format,
  duration = 600,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    if (from === value) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 5); // ease-out-expo-ish
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduce]);

  return <>{format(reduce ? value : display)}</>;
}

// --- TYPES ---
interface Campaign {
  id: string;
  name: string;
}

// New API 1 response: GET /api/dashboard/activity/table-data/
interface UserSummary {
  user_id: string;
  name: string;
  role: "employee" | "manager";
  total_responses: number;
  total_cities: number;
  ja_percentage: number;
  nei_percentage: number;
  ikke_hjemme_percentage: number;
}

interface SummaryData {
  total_users: number;
  total_responses: number;
  total_cities: number;
  date_range: {
    start_date: string | null;
    end_date: string | null;
  };
  campaigns: { campaign_id: string; campaign_name: string }[];
}

interface TableDataResponse {
  users: UserSummary[];
  summary: SummaryData;
}

// New API 2 response: GET /api/dashboard/activity/table-data/addresses/
interface AddressDetail {
  address_id: string | null;
  address_text: string;
  base_address: string;
  apartment_number: string | null;
  status: string;
  position: { lat: number; lng: number } | null;
  tags: Record<string, string>;
  recorded_at: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
}

interface CityDetail {
  city_name: string;
  total: number;
  ja_count: number;
  nei_count: number;
  ikke_hjemme_count: number;
  ja_percentage: number;
  nei_percentage: number;
  ikke_hjemme_percentage: number;
  addresses: AddressDetail[];
}

interface UserAddressResponse {
  user_id: string;
  user_name: string;
  user_role: string;
  total_responses: number;
  cities: CityDetail[];
}

// --- UTILS ---
const nbFmt = new Intl.NumberFormat("nb-NO");

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("no-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function todayDateISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

// Deterministic mock sparkline series — stable per user (seeded by name length)
function mockSparkSeries(seed: number) {
  const out: number[] = [];
  let v = 50;
  for (let i = 0; i < 7; i++) {
    // simple LCG
    seed = (seed * 9301 + 49297) % 233280;
    const delta = (seed / 233280) * 40 - 20;
    v = Math.max(5, Math.min(95, v + delta));
    out.push(Math.round(v));
  }
  return out;
}

// --- API FUNCTIONS ---
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

async function fetchCampaigns(): Promise<Campaign[]> {
  try {
    const token = await authService.getAccessToken();
    if (!token) throw new Error('Authentication required');

    const response = await fetch(`${API_BASE_URL}/api/campaigns/campaigns/all_campaigns/`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Campaigns API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : (data.results || []);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    throw error;
  }
}

// 1) Fetch lightweight user summary list
async function fetchTableData(filters: {
  campaign_ids: string[];
  start_date?: string;
  end_date?: string;
}): Promise<TableDataResponse> {
  const token = await authService.getAccessToken();
  if (!token) throw new Error('Authentication required');

  const params = new URLSearchParams();
  params.append('campaign_ids', filters.campaign_ids.join(','));
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date) params.append('end_date', filters.end_date);

  const res = await fetch(`${API_BASE_URL}/api/dashboard/activity/table-data/?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error(`Table data API returned ${res.status}: ${res.statusText}`);
  }

  return await res.json();
}

// 2) Fetch full city → address hierarchy for a specific user (on-demand)
async function fetchUserAddresses(filters: {
  user_id: string;
  campaign_ids: string[];
  start_date?: string;
  end_date?: string;
}): Promise<UserAddressResponse> {
  const token = await authService.getAccessToken();
  if (!token) throw new Error('Authentication required');

  const params = new URLSearchParams();
  params.append('user_id', filters.user_id);
  params.append('campaign_ids', filters.campaign_ids.join(','));
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date) params.append('end_date', filters.end_date);

  const res = await fetch(`${API_BASE_URL}/api/dashboard/activity/table-data/addresses/?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error(`User addresses API returned ${res.status}: ${res.statusText}`);
  }

  return await res.json();
}

// --- SUMMARY (hero TOTALT + 3 stacked secondary stats) ---
function SummaryCards({ tableData }: { tableData: TableDataResponse | null }) {
  if (!tableData) return null;

  const total = tableData.summary.total_responses || 0;

  let ja = 0;
  let nei = 0;
  let ikkeHjemme = 0;
  tableData.users.forEach((user) => {
    ja += Math.round((user.total_responses * user.ja_percentage) / 100);
    nei += Math.round((user.total_responses * user.nei_percentage) / 100);
    ikkeHjemme += Math.round((user.total_responses * user.ikke_hjemme_percentage) / 100);
  });

  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const jaPct = pct(ja);
  const neiPct = pct(nei);
  const ikkePct = pct(ikkeHjemme);

  const segments: { label: string; n: number; pct: number; bg: string; dot: string }[] = [
    { label: "Ja", n: ja, pct: jaPct, bg: "var(--ab-success-fg)", dot: "var(--ab-success-fg)" },
    { label: "Nei", n: nei, pct: neiPct, bg: "var(--ab-danger-fg)", dot: "var(--ab-danger-fg)" },
    { label: "Ikke hjemme", n: ikkeHjemme, pct: ikkePct, bg: "var(--ab-warning-fg)", dot: "var(--ab-warning-fg)" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-3 px-4 md:px-6">
      {/* Hero — TOTALT */}
      <div className="card-premium p-6 flex flex-col justify-between gap-4 min-h-[180px]">
        <div className="flex items-start justify-between">
          <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
            TOTALT REGISTRERINGER
          </div>
          {/* vs forrige periode badge — backend lacks prev-period data, em-dash placeholder */}
          <span
            className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] tracking-wider text-ab-fg-3 border border-ab-line-1 bg-ab-subtle/40"
            title="Sammenligning ikke tilgjengelig"
          >
            <span className="mono">—</span>
            <span>vs forrige periode</span>
          </span>
        </div>

        <div className="text-[48px] font-bold tracking-tight leading-none text-ab-fg tabular">
          <CountUp value={total} format={(n) => nbFmt.format(Math.round(n))} />
        </div>

        {/* Stacked-bar */}
        <div className="flex items-center w-full h-1.5 gap-0.5">
          {segments.map((s) => (
            <div
              key={s.label}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${Math.max(s.pct, s.n > 0 ? 1 : 0)}%`,
                background: s.bg,
              }}
              aria-label={`${s.label} ${s.pct.toFixed(1)}%`}
            />
          ))}
          {total === 0 && (
            <div className="h-full w-full rounded-full bg-ab-line-1" />
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ab-fg-2">
          {segments.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-sm shrink-0"
                style={{ background: s.dot }}
              />
              <span className="text-ab-fg-2">{s.label}</span>
              <span className="mono tabular text-ab-fg-3">
                {nbFmt.format(s.n)} · {s.pct.toFixed(1)}%
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Secondary stacked rows */}
      <div className="card-premium divide-y divide-ab-line-1 overflow-hidden">
        {segments.map((s) => (
          <div
            key={s.label}
            className="flex items-center justify-between px-5 py-4"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-sm shrink-0"
                style={{ background: s.dot }}
              />
              <span className="text-[13px] font-medium text-ab-fg-2 truncate">
                {s.label}
              </span>
            </div>
            <div className="flex flex-col items-end leading-tight">
              <span className="text-[22px] font-semibold text-ab-fg tabular">
                <CountUp value={s.n} format={(n) => nbFmt.format(Math.round(n))} />
              </span>
              <span className="text-[11px] text-ab-fg-3 tabular mono">
                {s.pct.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- CHIP (rounded pill filter) ---
function Chip({
  label,
  value,
  onClick,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-full",
        "border border-ab-line bg-ab-elevated text-[12px]",
        "hover:border-ab-line-2 hover:bg-ab-hover transition-colors"
      )}
    >
      <span className="text-[10px] uppercase tracking-wider text-ab-fg-3 font-semibold">
        {label}:
      </span>
      <span className="text-ab-fg font-medium">{value ?? children}</span>
      <ChevronDown className="h-3 w-3 text-ab-fg-3" />
    </button>
  );
}

// --- KAMPANJE MULTI-SELECT POPOVER ---
function KampanjeChip({
  campaigns,
  selectedCampaigns,
  setSelectedCampaigns,
}: {
  campaigns: Campaign[];
  selectedCampaigns: string[];
  setSelectedCampaigns: (campaigns: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  // Draft selection — only committed on "Bruk"
  const [draft, setDraft] = useState<string[]>(selectedCampaigns);

  // Sync draft when popover opens or external selection changes
  useEffect(() => {
    if (open) setDraft(selectedCampaigns);
  }, [open, selectedCampaigns]);

  const toggle = (id: string) => {
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const reset = () => setDraft([]);
  const apply = () => {
    setSelectedCampaigns(draft);
    setOpen(false);
  };

  const isActive =
    selectedCampaigns.length > 0 &&
    selectedCampaigns.length !== campaigns.length;
  const single =
    selectedCampaigns.length === 1
      ? campaigns.find((c) => c.id === selectedCampaigns[0])?.name
      : null;
  const label =
    !isActive
      ? "Alle"
      : single
      ? single
      : `${selectedCampaigns.length} valgte`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 h-8 px-3 rounded-full",
            "border bg-ab-elevated text-[12px] transition-colors",
            "hover:border-ab-line-2 hover:bg-ab-hover",
            open
              ? "ring-2 ring-ab-accent/15 border-ab-accent/30"
              : "border-ab-line"
          )}
        >
          {isActive && (
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-ab-accent shrink-0"
            />
          )}
          <span className="text-[10px] uppercase tracking-wider text-ab-fg-3 font-semibold">
            Kampanje:
          </span>
          <span className="text-ab-fg font-medium truncate max-w-[160px]">{label}</span>
          <ChevronDown className="h-3 w-3 text-ab-fg-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[360px] p-0 bg-ab-canvas border-ab-line">
        <div className="px-3 pt-3 pb-2 flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wider text-ab-fg-3 font-semibold">
            Velg kampanjer
          </div>
          <button
            onClick={reset}
            className="text-[11px] text-ab-fg-2 hover:text-ab-fg px-2 py-1 rounded-ab-md hover:bg-ab-hover"
          >
            Tilbakestill
          </button>
        </div>
        <Command className="bg-transparent">
          <CommandInput placeholder="Søk kampanjer..." className="h-9" />
          <CommandList className="max-h-64">
            <CommandEmpty>Ingen kampanjer funnet.</CommandEmpty>
            <CommandGroup>
              {campaigns.map((c) => {
                const isSelected = draft.includes(c.id);
                return (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    onSelect={() => toggle(c.id)}
                    className="flex items-center gap-2.5 cursor-pointer"
                  >
                    <span
                      className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                        isSelected
                          ? "bg-ab-accent border-ab-accent"
                          : "bg-transparent border-ab-line"
                      )}
                    >
                      {isSelected && (
                        <Check className="h-3 w-3 text-ab-on-accent" strokeWidth={3} />
                      )}
                    </span>
                    <span className="flex-1 truncate text-[13px] text-ab-fg">
                      {c.name}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="flex items-center justify-between border-t border-ab-line-1 px-3 py-2">
          <span className="text-[12px] text-ab-fg-2">
            {draft.length === 0 || draft.length === campaigns.length
              ? "Alle"
              : `${draft.length} valgt`}
          </span>
          <button onClick={apply} className="ab-btn primary h-8">
            Bruk
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// --- MIN DØRER POPOVER ---
function MinDoorsChip({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const apply = () => {
    const n = parseInt(draft, 10);
    onChange(isNaN(n) ? 0 : Math.max(0, n));
    setOpen(false);
  };

  const isActive = value > 0;
  const presets = [50, 100, 250, 500];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 h-8 px-3 rounded-full",
            "border bg-ab-elevated text-[12px] transition-colors",
            "hover:border-ab-line-2 hover:bg-ab-hover",
            open
              ? "ring-2 ring-ab-accent/15 border-ab-accent/30"
              : "border-ab-line"
          )}
        >
          {isActive && (
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ab-accent shrink-0" />
          )}
          <span className="text-[10px] uppercase tracking-wider text-ab-fg-3 font-semibold">
            Min Dører:
          </span>
          <span className="text-ab-fg font-medium mono">{value}</span>
          <ChevronDown className="h-3 w-3 text-ab-fg-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3 bg-ab-canvas border-ab-line">
        <div className="eyebrow mb-2">Minimum dører</div>
        <input
          type="number"
          className="ab-input w-full h-8 text-[13px] mono"
          style={{ paddingLeft: 12 }}
          value={draft}
          min={0}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply();
          }}
        />
        <div className="flex flex-wrap gap-1 mt-2">
          {presets.map((p) => {
            const active = parseInt(draft, 10) === p;
            return (
              <button
                key={p}
                onClick={() => setDraft(String(p))}
                className={cn(
                  "h-7 px-2.5 rounded-full text-[11px] mono border transition-colors",
                  active
                    ? "bg-ab-accent text-ab-on-accent border-ab-accent"
                    : "bg-ab-elevated text-ab-fg-2 border-ab-line hover:border-ab-line-2"
                )}
              >
                {p}
              </button>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={() => {
              onChange(0);
              setOpen(false);
            }}
            className="ab-btn ghost"
          >
            Nullstill
          </button>
          <button onClick={apply} className="ab-btn primary">
            Bruk
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// --- PERIODE CHIP (date range) ---
function PeriodeChip({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
}: {
  startDate: string;
  endDate: string;
  setStartDate: (d: string) => void;
  setEndDate: (d: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = `${formatDate(startDate)} → ${formatDate(endDate)}`;

  const setPreset = (kind: string) => {
    const today = todayDateISO();
    const now = new Date();
    if (kind === "today") {
      setStartDate(today);
      setEndDate(today);
    } else if (kind === "yesterday") {
      const y = daysAgoISO(1);
      setStartDate(y);
      setEndDate(y);
    } else if (kind === "7d") {
      setStartDate(daysAgoISO(7));
      setEndDate(today);
    } else if (kind === "30d") {
      setStartDate(daysAgoISO(30));
      setEndDate(today);
    } else if (kind === "thisMonth") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(first.toISOString().slice(0, 10));
      setEndDate(today);
    } else if (kind === "lastMonth") {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(first.toISOString().slice(0, 10));
      setEndDate(last.toISOString().slice(0, 10));
    }
  };

  const presets: { label: string; key: string }[] = [
    { label: "I dag", key: "today" },
    { label: "I går", key: "yesterday" },
    { label: "Siste 7 dager", key: "7d" },
    { label: "Siste 30 dager", key: "30d" },
    { label: "Denne måneden", key: "thisMonth" },
    { label: "Forrige måned", key: "lastMonth" },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 h-8 px-3 rounded-full",
            "border bg-ab-elevated text-[12px] transition-colors",
            "hover:border-ab-line-2 hover:bg-ab-hover",
            open
              ? "ring-2 ring-ab-accent/15 border-ab-accent/30"
              : "border-ab-line"
          )}
        >
          <span className="text-[10px] uppercase tracking-wider text-ab-fg-3 font-semibold">
            Periode:
          </span>
          <span className="text-ab-fg font-medium mono">{label}</span>
          <ChevronDown className="h-3 w-3 text-ab-fg-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[420px] p-0 bg-ab-canvas border-ab-line">
        <div className="grid grid-cols-[140px_1fr]">
          {/* Presets */}
          <div className="border-r border-ab-line-1 py-2">
            {presets.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className="w-full text-left px-3 py-1.5 text-[12px] text-ab-fg-2 hover:bg-ab-hover hover:text-ab-fg transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Date inputs */}
          <div className="p-3 space-y-2">
            <div>
              <div className="eyebrow mb-1">Fra</div>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-[12px]"
              />
            </div>
            <div>
              <div className="eyebrow mb-1">Til</div>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-[12px]"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// --- ADDRESS ITEM (slide-over) ---
const AddressItem = memo(function AddressItem({ address }: { address: AddressDetail }) {
  const displayAddress = address.apartment_number
    ? `${address.base_address}, ${address.apartment_number}`
    : address.base_address || address.address_text;

  const statusLower = address.status.toLowerCase();
  const pillTone =
    statusLower === "ja"
      ? "success"
      : statusLower === "nei"
      ? "danger"
      : "warn";
  const pillLabel =
    statusLower === "ja"
      ? "Ja"
      : statusLower === "nei"
      ? "Nei"
      : statusLower === "ikke_hjemme" || statusLower === "ikke hjemme"
      ? "Ikke hjemme"
      : address.status;

  return (
    <div className="h-9 flex items-center gap-3 px-3 hover:bg-ab-hover/40 transition-colors">
      <span className="mono text-[11px] text-ab-fg-3 shrink-0 w-14">
        {address.tags?.postnr || "—"}
      </span>
      <span className="flex-1 min-w-0 truncate text-[12px] text-ab-fg-2">{displayAddress}</span>
      <span className={cn("ab-pill", pillTone)}>
        <span className="ab-dot" />
        {pillLabel}
      </span>
    </div>
  );
});

// --- CITY ACCORDION (slide-over) ---
const CityAccordion = memo(function CityAccordion({ city }: { city: CityDetail }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-b border-ab-line-1">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full h-8 flex items-center gap-2 px-3 hover:bg-ab-hover/40 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 text-ab-fg-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-ab-fg-3 shrink-0" />
        )}
        <span className="eyebrow flex-1">{city.city_name}</span>
        <span className="mono text-[11px] text-ab-fg-2">{nbFmt.format(city.total)}</span>
      </button>
      {isExpanded && (
        <div className="bg-ab-base/40">
          {city.addresses.map((address, index) => (
            <AddressItem key={address.address_id || index} address={address} />
          ))}
        </div>
      )}
    </div>
  );
});

// --- LOADING SPINNER ---
function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center p-8">
      <Loader2 className="h-5 w-5 animate-spin text-ab-accent" />
    </div>
  );
}

// --- LOADING SKELETON ---
function LoadingSkeleton() {
  return (
    <div className="px-4 md:px-6 space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-14 flex items-center gap-4 px-3 rounded-ab-md border border-ab-line-1 bg-ab-elevated animate-pulse"
        >
          <div className="w-7 h-7 rounded-full bg-ab-active shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-32 bg-ab-active rounded" />
            <div className="h-2 w-20 bg-ab-active/60 rounded" />
          </div>
          <div className="w-16 h-3 bg-ab-active rounded" />
          <div className="w-12 h-3 bg-ab-active rounded" />
          <div className="w-20 h-3 bg-ab-active rounded" />
        </div>
      ))}
    </div>
  );
}

// --- RANK ACCENT ---
function rankBarColor(rank: number): string | null {
  if (rank === 1) return "#C8A24A"; // gold
  if (rank === 2) return "#B0B4BA"; // silver
  if (rank === 3) return "#B08A4A"; // bronze
  return null;
}

// --- LEADERBOARD TABLE ---
function RapportTable({
  data,
  loading = false,
  onClearFilters,
  searchQuery,
  setSearchQuery,
  minDoors,
  onRowClick,
}: {
  data: TableDataResponse | null;
  loading?: boolean;
  onClearFilters?: () => void;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  minDoors: number;
  onRowClick: (user: UserSummary) => void;
}) {
  // Filter + sort (always called — even when data is null — to keep hook order stable)
  const filteredUsers = useMemo(() => {
    if (!data) return [] as UserSummary[];
    let filtered = [...data.users];
    if (searchQuery) {
      filtered = filtered.filter((u) =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (minDoors > 0) {
      filtered = filtered.filter((u) => u.total_responses >= minDoors);
    }
    filtered.sort((a, b) => b.total_responses - a.total_responses);
    return filtered;
  }, [data, searchQuery, minDoors]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!data) {
    return (
      <div className="px-4 md:px-6">
        <div className="ab-card p-12 text-center">
          <FileText className="h-10 w-10 text-ab-fg-3 mx-auto mb-3" />
          <p className="text-[13px] text-ab-fg-2">Ingen data tilgjengelig</p>
        </div>
      </div>
    );
  }

  const maxTotal = filteredUsers.length > 0
    ? Math.max(...filteredUsers.map((u) => u.total_responses), 1)
    : 1;

  // Totals row
  const totalResponses = filteredUsers.reduce((s, u) => s + u.total_responses, 0);
  const avgJa = filteredUsers.length > 0
    ? filteredUsers.reduce((s, u) => s + u.ja_percentage, 0) / filteredUsers.length
    : 0;

  if (filteredUsers.length === 0) {
    return (
      <div className="px-4 md:px-6">
        <div className="card-premium p-16 text-center">
          <SearchX className="h-14 w-14 text-ab-fg-3 mx-auto" strokeWidth={1.25} />
          <h3 className="mt-3 text-[16px] font-medium text-ab-fg">Ingen resultater</h3>
          <p className="mt-1 text-[13px] text-ab-fg-2">
            Prøv å justere filtrene eller perioden
          </p>
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => {
                setSearchQuery("");
                if (onClearFilters) onClearFilters();
              }}
              className="ab-btn primary"
            >
              <X className="h-3.5 w-3.5" />
              Tilbakestill filtre
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6">
      <div className="ab-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ab-table w-full">
            <thead>
              <tr>
                <th className="w-12 text-left">RANG</th>
                <th className="text-left">ANSATT</th>
                <th className="text-right">DØRER</th>
                <th className="text-right">JA %</th>
                <th className="text-right">KONTAKT %</th>
                <th className="text-right">SALG</th>
                <th className="text-right">STIM</th>
                <th className="text-left w-[120px]">TREND 7D</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, idx) => {
                const rank = idx + 1;
                const rankColor = rankBarColor(rank);
                const dorerPct = (user.total_responses / maxTotal) * 100;
                const ja = user.ja_percentage;
                const jaColor =
                  ja >= 30
                    ? "text-ab-success"
                    : ja >= 15
                    ? "text-ab-fg"
                    : "text-ab-danger";
                const spark = mockSparkSeries(user.name.length + user.total_responses);
                const region = user.role === "manager" ? "Manager" : "Felt · Norge";
                const stim = "—";
                const kontakt = "—";
                const salg = "—";

                return (
                  <tr
                    key={user.user_id}
                    onClick={() => onRowClick(user)}
                    className="relative cursor-pointer group hover:bg-ab-subtle/60 transition-colors duration-150"
                    style={{ height: 56 }}
                  >
                    <td className="relative">
                      {rankColor && (
                        <span
                          className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r"
                          style={{ background: rankColor }}
                        />
                      )}
                      <span className="mono text-[12px] text-ab-fg-2 pl-2">{rank}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-ab-active flex items-center justify-center shrink-0 ring-1 ring-inset ring-black/5 dark:ring-white/10">
                          <span className="text-[10px] font-semibold text-ab-fg-2">
                            {getInitials(user.name)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-ab-fg truncate">
                            {user.name}
                          </div>
                          <div className="text-[10px] text-ab-fg-3 uppercase tracking-wider">
                            {region}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="mono text-[13px] text-ab-fg tabular">
                          {nbFmt.format(user.total_responses)}
                        </span>
                        <div className="h-1 w-20 rounded-full bg-ab-active overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${dorerPct}%`,
                              background: "var(--ab-accent-9)",
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="text-right">
                      <span className={cn("mono text-[13px] font-semibold tabular", jaColor)}>
                        {ja.toFixed(1)}
                        <span className="text-ab-fg-3 font-normal">%</span>
                      </span>
                    </td>
                    <td className="text-right mono text-[13px] text-ab-fg-3 opacity-60">
                      {kontakt}
                    </td>
                    <td className="text-right mono text-[14px] font-medium text-ab-fg-3 opacity-60">
                      {salg}
                    </td>
                    <td className="text-right mono text-[12px] text-ab-fg-3 opacity-60">{stim}</td>
                    <td>
                      <div
                        style={{
                          filter:
                            "drop-shadow(0 1px 2px color-mix(in srgb, var(--ab-accent-9) 25%, transparent))",
                        }}
                      >
                        <Sparkline data={spark} width={96} height={28} stroke="var(--ab-accent-9)" />
                      </div>
                    </td>
                    <td className="text-ab-fg-3 group-hover:text-ab-fg">
                      <ChevronRight className="h-4 w-4" />
                    </td>
                  </tr>
                );
              })}
              {/* Totals / Sum row */}
              <tr
                style={{
                  borderTop: "2px solid var(--ab-border-strong)",
                  background: "var(--ab-bg-subtle)",
                }}
              >
                <td colSpan={2} className="text-[10px] uppercase tracking-wider font-semibold text-ab-fg-2 pl-2">
                  Sum / Snitt
                </td>
                <td className="text-right">
                  <span className="mono text-[13px] font-semibold text-ab-fg tabular">
                    {nbFmt.format(totalResponses)}
                  </span>
                </td>
                <td className="text-right mono text-[13px] font-semibold text-ab-fg tabular">
                  {avgJa.toFixed(1)}
                  <span className="text-ab-fg-3 font-normal">%</span>
                </td>
                <td className="text-right text-ab-fg-3 opacity-60">—</td>
                <td className="text-right text-ab-fg-3 opacity-60">—</td>
                <td className="text-right text-ab-fg-3 opacity-60">—</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- SLIDE-OVER DETAIL PANEL ---
function AgentDetailPanel({
  user,
  addressData,
  loadingAddresses,
  onClose,
}: {
  user: UserSummary | null;
  addressData: UserAddressResponse | null;
  loadingAddresses: boolean;
  onClose: () => void;
}) {
  if (!user) return null;

  const firstCity = addressData?.cities?.[0]?.city_name || "—";
  const firstPostnr =
    addressData?.cities?.[0]?.addresses?.[0]?.tags?.postnr || "—";

  const ja = Math.round((user.total_responses * user.ja_percentage) / 100);
  const region = user.role === "manager" ? "Manager" : "Felt · Norge";

  // Radar axes — values normalised 0-100
  const radarData = [
    { axis: "Dører", value: Math.min(100, Math.round((user.total_responses / 500) * 100)) },
    { axis: "Ja %", value: Math.round(user.ja_percentage) },
    { axis: "Kontakt %", value: Math.round(100 - user.ikke_hjemme_percentage) },
    { axis: "Stim", value: 50 },
    { axis: "Konsistens", value: 60 },
    { axis: "Salg", value: 40 },
  ];

  // Trend data (uses same deterministic mock as the table sparkline column)
  const trend = mockSparkSeries(user.name.length + user.total_responses);
  const trendData = trend.map((v, i) => ({ day: i + 1, value: v }));
  const trendAvg = trend.reduce((a, b) => a + b, 0) / trend.length;

  return (
    <SheetContent
      side="right"
      className="w-[520px] sm:max-w-[520px] bg-ab-canvas border-l border-ab-line p-0 overflow-y-auto"
    >
      {/* hidden title for a11y */}
      <SheetTitle className="sr-only">{user.name}</SheetTitle>

      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-ab-canvas border-b border-ab-line-1">
        {/* Breadcrumb + close */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-ab-fg-3 truncate">
            <span className="text-ab-fg-2">{user.name}</span>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span>{firstCity}</span>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span className="mono">{firstPostnr}</span>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 -mr-1 rounded-full inline-flex items-center justify-center text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover transition-colors"
            aria-label="Lukk"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Avatar + name */}
        <div className="px-5 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 ring-1 ring-inset ring-black/5 dark:ring-white/10"
              style={{ background: "var(--ab-bg-active)" }}
            >
              <span className="text-[14px] font-semibold text-ab-fg-2">
                {getInitials(user.name)}
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-[18px] font-semibold text-ab-fg truncate">
                {user.name}
              </div>
              <div className="text-[12px] text-ab-fg-3">{region}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat block — hero DØRER + 3 stacked secondaries */}
      <div className="px-5 pt-4">
        <div className="card-premium overflow-hidden">
          <div className="grid grid-cols-[1.1fr_1fr]">
            {/* Primary */}
            <div className="p-4 border-r border-ab-line-1">
              <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
                DØRER
              </div>
              <div className="mt-2 text-[36px] font-semibold tracking-tight leading-none text-ab-fg tabular">
                <CountUp value={user.total_responses} format={(n) => nbFmt.format(Math.round(n))} />
              </div>
            </div>
            {/* Secondaries */}
            <div className="divide-y divide-ab-line-1">
              <div className="px-4 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
                  JA %
                </div>
                <div className="text-[18px] font-semibold text-ab-success tabular leading-tight">
                  {user.ja_percentage.toFixed(1)}
                </div>
              </div>
              <div className="px-4 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
                  NEI %
                </div>
                <div className="text-[18px] font-semibold text-ab-danger tabular leading-tight">
                  {user.nei_percentage.toFixed(1)}
                </div>
              </div>
              <div className="px-4 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
                  IKKE HJEMME %
                </div>
                <div className="text-[18px] font-semibold text-ab-warning tabular leading-tight">
                  {user.ikke_hjemme_percentage.toFixed(1)}
                </div>
              </div>
              <div className="px-4 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
                  SALG
                </div>
                <div className="text-[18px] font-medium text-ab-fg-3 tabular leading-tight">—</div>
              </div>
              <div className="px-4 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
                  STIM
                </div>
                <div className="text-[18px] font-medium text-ab-fg-3 tabular leading-tight">—</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trend chart */}
      <div className="px-5 pt-6">
        <div className="text-[11px] uppercase tracking-wider text-ab-fg-3 font-semibold mb-2">
          AKTIVITET · SISTE 7 DAGER
        </div>
        <div className="card-premium p-3" style={{ height: 120 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <ReferenceLine
                y={trendAvg}
                stroke="var(--ab-border-default)"
                strokeDasharray="2 4"
                ifOverflow="extendDomain"
              />
              <Tooltip
                cursor={{ stroke: "var(--ab-border-default)", strokeWidth: 1 }}
                contentStyle={{
                  background: "var(--ab-bg-elevated)",
                  border: "1px solid var(--ab-border-default)",
                  borderRadius: 6,
                  fontSize: 11,
                }}
                labelFormatter={(l) => `Dag ${l}`}
                formatter={(v: number) => [v, "Aktivitet"]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--ab-accent-9)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, fill: "var(--ab-accent-9)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Radar */}
      <div className="px-5 pt-6">
        <div className="text-[11px] uppercase tracking-wider text-ab-fg-3 font-semibold mb-2">
          ANSATTPROFIL · 6 AKSER
        </div>
        <div className="card-premium p-3" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius={100}>
              <PolarGrid stroke="var(--ab-border-subtle)" />
              <PolarAngleAxis
                dataKey="axis"
                tick={{ fill: "var(--ab-text-tertiary)", fontSize: 11 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <Radar
                name={user.name}
                dataKey="value"
                stroke="var(--ab-accent-9)"
                fill="var(--ab-accent-9)"
                fillOpacity={0.12}
                strokeWidth={1.5}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Underlagte områder */}
      <div className="px-5 pt-6 pb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wider text-ab-fg-3 font-semibold">
            UNDERLAGTE OMRÅDER
          </div>
          {addressData && (
            <span className="text-[11px] text-ab-fg-3 mono">
              {addressData.cities.length}
            </span>
          )}
        </div>
        <div className="card-premium overflow-hidden">
          {loadingAddresses && (
            <div className="p-6 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-ab-accent" />
            </div>
          )}
          {!loadingAddresses && !addressData && (
            <div className="p-6 text-center">
              <p className="text-[12px] text-ab-fg-3">Kunne ikke laste detaljer</p>
            </div>
          )}
          {!loadingAddresses && addressData && addressData.cities.length === 0 && (
            <div className="p-6 text-center">
              <p className="text-[12px] text-ab-fg-3">Ingen områder</p>
            </div>
          )}
          {!loadingAddresses && addressData && addressData.cities.length > 0 && (
            <div>
              <div className="h-9 grid grid-cols-[1fr_64px_56px] items-center px-3 border-b border-ab-line-1 bg-ab-subtle/40">
                <span className="eyebrow">OMRÅDE</span>
                <span className="eyebrow text-right">POSTNR</span>
                <span className="eyebrow text-right">SALG</span>
              </div>
              {addressData.cities.map((city) => (
                <CityAccordion key={city.city_name} city={city} />
              ))}
            </div>
          )}
        </div>
      </div>

    </SheetContent>
  );
}

// --- MAIN PAGE ---
export default function RapportPage() {
  // State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(daysAgoISO(7));
  const [endDate, setEndDate] = useState(todayDateISO());

  // Data states
  const [tableData, setTableData] = useState<TableDataResponse | null>(null);
  const [expandedUserAddresses, setExpandedUserAddresses] = useState<Map<string, UserAddressResponse>>(new Map());
  const [loadingAddressesSet, setLoadingAddressesSet] = useState<Set<string>>(new Set());

  // Loading states
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingTableData, setLoadingTableData] = useState(true);

  // UI state
  const [periodRange, setPeriodRange] = useState("1W");
  const [searchQuery, setSearchQuery] = useState("");
  const [minDoors, setMinDoors] = useState(100);
  const [selectedRow, setSelectedRow] = useState<UserSummary | null>(null);

  // Track current filters for address fetching
  const currentFiltersRef = useRef<{
    campaign_ids: string[];
    start_date: string;
    end_date: string;
  }>({ campaign_ids: [], start_date: '', end_date: '' });

  // Fetch campaigns on mount
  useEffect(() => {
    const loadCampaigns = async () => {
      setLoadingCampaigns(true);
      try {
        const campaignsData = await fetchCampaigns();
        setCampaigns(campaignsData);
      } catch (err) {
        console.error('Error fetching campaigns:', err);
      } finally {
        setLoadingCampaigns(false);
      }
    };
    loadCampaigns();
  }, []);

  // Fetch table data when filters or selected campaigns change
  useEffect(() => {
    if (campaigns.length === 0 && loadingCampaigns) {
      return;
    }

    const loadData = async () => {
      setLoadingTableData(true);

      const campaignIds = (!selectedCampaigns || selectedCampaigns.length === 0)
        ? campaigns.map((c) => c.id)
        : selectedCampaigns;

      const filters = {
        campaign_ids: campaignIds,
        start_date: startDate,
        end_date: endDate,
      };

      currentFiltersRef.current = filters;

      setExpandedUserAddresses(new Map());
      setLoadingAddressesSet(new Set());

      try {
        const tableDataResult = await fetchTableData(filters);
        setTableData(tableDataResult);
      } catch (err) {
        console.error('Error fetching table data:', err);
        setTableData(null);
      } finally {
        setLoadingTableData(false);
      }
    };

    loadData();
  }, [startDate, endDate, selectedCampaigns, campaigns, loadingCampaigns]);

  // Handle user click — fetch address data on row click
  const handleToggleUser = useCallback(async (userId: string) => {
    if (expandedUserAddresses.has(userId)) {
      return;
    }

    setLoadingAddressesSet((prev) => {
      const next = new Set(prev);
      next.add(userId);
      return next;
    });

    try {
      const filters = currentFiltersRef.current;
      const addressData = await fetchUserAddresses({
        user_id: userId,
        campaign_ids: filters.campaign_ids,
        start_date: filters.start_date,
        end_date: filters.end_date,
      });

      setExpandedUserAddresses((prev) => {
        const next = new Map(prev);
        next.set(userId, addressData);
        return next;
      });
    } catch (err) {
      console.error(`Error fetching addresses for user ${userId}:`, err);
    } finally {
      setLoadingAddressesSet((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  }, [expandedUserAddresses]);

  // Map period pill to date range
  const handlePeriodChange = useCallback((value: string) => {
    setPeriodRange(value);
    const today = todayDateISO();
    if (value === "1D") {
      setStartDate(daysAgoISO(1));
      setEndDate(today);
    } else if (value === "1W") {
      setStartDate(daysAgoISO(7));
      setEndDate(today);
    } else if (value === "1M") {
      setStartDate(daysAgoISO(30));
      setEndDate(today);
    } else if (value === "YTD") {
      const year = new Date().getFullYear();
      setStartDate(`${year}-01-01`);
      setEndDate(today);
    }
  }, []);

  // Clear filters
  const handleClearFilters = useCallback(() => {
    setStartDate(daysAgoISO(7));
    setEndDate(todayDateISO());
    setSelectedCampaigns([]);
    setMinDoors(0);
    setSearchQuery("");
    setPeriodRange("1W");
  }, []);

  // Trigger address fetch when row selected
  const handleRowClick = useCallback((user: UserSummary) => {
    setSelectedRow(user);
    handleToggleUser(user.user_id);
  }, [handleToggleUser]);

  const selectedAddressData = selectedRow
    ? expandedUserAddresses.get(selectedRow.user_id) || null
    : null;
  const selectedLoading = selectedRow
    ? loadingAddressesSet.has(selectedRow.user_id)
    : false;

  const handleExportPDF = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    toast({
      title: "Genererer PDF...",
      description: "Forbereder rapport for nedlasting.",
    });
    try {
      window.print();
      toast({
        title: `Lastet ned rapport-${today}.pdf`,
        description: "PDF-eksporten er klar.",
      });
    } catch (e) {
      toast({
        title: "Eksport feilet",
        description: "Prøv igjen.",
        variant: "destructive",
      });
    }
  }, []);

  return (
    <ProtectedRoute>
      <ClientLayout>
        <div className="relative flex min-h-screen flex-col bg-ab-base bg-page-glow">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.035] dark:opacity-[0.06]"
            style={{
              maskImage: "linear-gradient(to bottom, black, transparent 70%)",
              WebkitMaskImage: "linear-gradient(to bottom, black, transparent 70%)",
            }}
          />
          <div className="relative z-10 flex-1 w-full">
            <PageHeader
              eyebrow="DRILL-DOWN · ANSATT · LOKASJON · POSTNUMMER"
              title="Rapport"
              range
              rangeValue={periodRange}
              onRangeChange={handlePeriodChange}
              action={
                <button
                  className="ab-btn primary"
                  onClick={handleExportPDF}
                >
                  <Download className="h-3.5 w-3.5" />
                  Eksporter PDF
                </button>
              }
            />

            {/* Filter chip row */}
            <div className="flex items-center gap-2 flex-wrap px-4 md:px-6 py-3 border-b border-ab-line-1 bg-ab-base">
              <Chip label="Team" value="Alle" />
              <KampanjeChip
                campaigns={campaigns}
                selectedCampaigns={selectedCampaigns}
                setSelectedCampaigns={setSelectedCampaigns}
              />
              <MinDoorsChip value={minDoors} onChange={setMinDoors} />
              <PeriodeChip
                startDate={startDate}
                endDate={endDate}
                setStartDate={setStartDate}
                setEndDate={setEndDate}
              />
              <button
                className={cn(
                  "inline-flex items-center gap-1 h-8 px-3 rounded-full",
                  "border border-dashed border-ab-line text-[12px] text-ab-fg-3",
                  "hover:border-ab-line-2 hover:text-ab-fg transition-colors"
                )}
              >
                <Plus className="h-3 w-3" />
                Filter
              </button>
              <div className="ml-auto relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ab-fg-3 pointer-events-none z-10" />
                <input
                  type="text"
                  placeholder="Søk agent..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ab-input h-8 w-full text-[12px] rounded-full bg-ab-subtle border-ab-line hover:border-ab-line-2 focus:border-ab-accent transition-colors"
                  style={{ paddingLeft: 32, paddingRight: 12 }}
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Body */}
            <div className="py-4 space-y-4">
              {loadingTableData ? (
                <>
                  <div className="px-4 md:px-6">
                    <LoadingSpinner />
                  </div>
                  <LoadingSkeleton />
                </>
              ) : (
                <>
                  <SummaryCards tableData={tableData} />
                  <RapportTable
                    data={tableData}
                    loading={loadingTableData}
                    onClearFilters={handleClearFilters}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    minDoors={minDoors}
                    onRowClick={handleRowClick}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Slide-over panel */}
        <Sheet
          open={selectedRow !== null}
          onOpenChange={(o) => {
            if (!o) setSelectedRow(null);
          }}
        >
          <AgentDetailPanel
            user={selectedRow}
            addressData={selectedAddressData}
            loadingAddresses={selectedLoading}
            onClose={() => setSelectedRow(null)}
          />
        </Sheet>
      </ClientLayout>
    </ProtectedRoute>
  );
}

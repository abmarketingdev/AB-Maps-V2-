"use client"

import React from "react"

import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react"
import {
  Search,
  Download,
  Plus,
  Filter,
  ChevronDown,
  ChevronRight,
  Inbox,
  X,
  Calendar,
  Tag,
  Rows3,
  Columns3,
  Check,
} from "lucide-react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { useTheme } from "next-themes"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader, Sparkline, StatusPill } from "@/components/ui-ab"
import { fetchCampaigns, setSelectedCampaign, getSelectedCampaign, clearInvalidCampaignData } from "./services/activitiesService"
import { authService } from "./lib/auth/authService"
import LoginPrompt from "./components/LoginPrompt"
import RegisterSalePopup from "@/components/RegisterSalePopup"
import { cn } from "@/lib/utils"
import { stringToHsl } from "@/lib/stringToHsl"
import { SmartAvatar } from "@/components/gamification/SmartAvatar"

// ─── Density + column-visibility config ──────────────────────────────────────
type Density = "compact" | "default" | "comfortable"
const DENSITY_HEIGHT: Record<Density, number> = { compact: 36, default: 44, comfortable: 52 }
const DENSITY_LABEL: Record<Density, string> = {
  compact: "Kompakt",
  default: "Standard",
  comfortable: "Romslig",
}

interface ColumnConfig {
  key: string
  label: string
  always?: boolean
}
const COLUMNS: ColumnConfig[] = [
  { key: "select",   label: "Velg",     always: true },
  { key: "tid",      label: "Tid" },
  { key: "ansatt",   label: "Ansatt",   always: true },
  { key: "adresse",  label: "Adresse" },
  { key: "omrade",   label: "Område" },
  { key: "produkt",  label: "Produkt" },
  { key: "belop",    label: "Beløp" },     // only when isNorskFolkehjelp
  { key: "status",   label: "Status" },
]

// ─── Animated count-up (tabular) ─────────────────────────────────────────────
function CountUp({
  value,
  duration = 600,
  format = (n: number) => n.toString(),
  className,
}: {
  value: number
  duration?: number
  format?: (n: number) => string
  className?: string
}) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const prev = useRef(value)
  useEffect(() => {
    if (reduce || !Number.isFinite(value)) {
      setDisplay(value)
      prev.current = value
      return
    }
    const start = prev.current
    if (start === value) return
    const startT = performance.now()
    let raf: number
    const tick = (t: number) => {
      const p = Math.min(1, (t - startT) / duration)
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
      setDisplay(start + (value - start) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
      else prev.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration, reduce])
  return <span className={cn("mono tabular", className)}>{format(Math.round(display))}</span>
}

type SortOrder = "asc" | "desc"

// Unified interface for sales data from the new API
interface UnifiedSalesData {
  seller: string
  campaign_name: string
  date: string
  gavebelop: number | null
}

// Grouped sales by date
interface GroupedSales {
  date: string
  sales: UnifiedSalesData[]
  totalAmount?: number
}

const nfNb = new Intl.NumberFormat("nb-NO")

function formatKr(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  return `${nfNb.format(Math.round(value))} kr`
}

function getInitials(name: string): string {
  if (!name) return "—"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// SalesTable component for modular table rendering with grouping
interface SalesTableProps {
  salesData: UnifiedSalesData[]
  loading: boolean
  error: string | null
  sortOrder: SortOrder
  onDateSort: () => void
  isNorskFolkehjelp: boolean
  startDate?: string
  endDate?: string
  searchTerm?: string
  onClearFilters?: () => void
  density?: Density
  visibleColumns?: Record<string, boolean>
}

const SalesTable = memo(function SalesTable({
  salesData,
  loading,
  error,
  sortOrder,
  onDateSort,
  isNorskFolkehjelp,
  startDate,
  endDate,
  searchTerm,
  onClearFilters,
  density = "default",
  visibleColumns,
}: SalesTableProps) {
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const reduce = useReducedMotion()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const rowMinH = DENSITY_HEIGHT[density]
  const isCol = (k: string) => (visibleColumns ? visibleColumns[k] !== false : true)

  // Group sales by date
  const groupedSales: GroupedSales[] = salesData.reduce((acc: GroupedSales[], item) => {
    const dateStr = new Date(item.date).toLocaleDateString("no-NO")
    const existingGroup = acc.find((g) => g.date === dateStr)

    if (existingGroup) {
      existingGroup.sales.push(item)
      if (isNorskFolkehjelp && item.gavebelop !== null) {
        existingGroup.totalAmount = (existingGroup.totalAmount || 0) + item.gavebelop
      }
    } else {
      acc.push({
        date: dateStr,
        sales: [item],
        totalAmount: isNorskFolkehjelp && item.gavebelop !== null ? item.gavebelop : 0,
      })
    }

    return acc
  }, [])

  const toggleDate = (date: string) => {
    const newExpanded = new Set(expandedDates)
    if (newExpanded.has(date)) {
      newExpanded.delete(date)
    } else {
      newExpanded.add(date)
    }
    setExpandedDates(newExpanded)
  }

  const toggleRow = (key: string) => {
    const next = new Set(selectedRows)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelectedRows(next)
  }

  // Loading State — proper shadcn Skeleton rows matching density
  if (loading) {
    return (
      <div className="p-3 space-y-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="w-full rounded-ab-sm" style={{ height: rowMinH }} />
        ))}
      </div>
    )
  }

  // Error State
  if (error) {
    return (
      <div className="flex items-center justify-center py-16 px-4">
        <div className="text-center">
          <p className="text-sm text-ab-danger mb-1">{error}</p>
          <p className="text-xs text-ab-fg-3">Vennligst prøv igjen senere</p>
        </div>
      </div>
    )
  }

  // Empty State
  if (groupedSales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-12 h-12 rounded-full bg-ab-hover flex items-center justify-center mb-4">
          <Inbox className="h-6 w-6 text-ab-fg-3" />
        </div>
        <div className="eyebrow mb-1">INGEN TREFF</div>
        <h3 className="text-sm font-semibold text-ab-fg mb-1">Ingen salg funnet</h3>
        <p className="text-xs text-ab-fg-3 text-center mb-4 max-w-xs">
          Vi fant ingen salg som matcher dine filterkriterier
        </p>
        {(startDate || endDate || searchTerm) && onClearFilters && (
          <button onClick={onClearFilters} className="ab-btn ghost">
            <X className="mr-2 h-3.5 w-3.5" />
            Nullstill filtre
          </button>
        )}
      </div>
    )
  }

  // Build the grid-cols template dynamically from visible columns
  const colTemplates: Record<string, string> = {
    select:  "36px",
    tid:     "92px",
    ansatt:  "minmax(180px,1.4fr)",
    adresse: "minmax(180px,1.6fr)",
    omrade:  "minmax(100px,0.9fr)",
    produkt: "minmax(120px,1fr)",
    belop:   "minmax(120px,0.9fr)",
    status:  "120px",
  }
  const orderedCols = [
    "select", "tid", "ansatt", "adresse", "omrade", "produkt",
    ...(isNorskFolkehjelp ? ["belop"] : []),
    "status",
  ]
  const gridTemplate = orderedCols
    .filter(isCol)
    .map((k) => colTemplates[k])
    .join(" ")

  return (
    <div className="w-full">
      {/* Header */}
      <div
        className="sticky top-0 z-10 grid items-center bg-ab-canvas border-b border-ab-line px-4 py-3"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {isCol("select") && <div />}
        {isCol("tid") && (
          <button
            type="button"
            onClick={onDateSort}
            className="eyebrow text-left hover:text-ab-fg transition-colors flex items-center gap-1"
          >
            TID
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                sortOrder === "asc" && "rotate-180",
              )}
            />
          </button>
        )}
        {isCol("ansatt") && <div className="eyebrow">ANSATT</div>}
        {isCol("adresse") && <div className="eyebrow">ADRESSE</div>}
        {isCol("omrade") && <div className="eyebrow">OMRÅDE</div>}
        {isCol("produkt") && <div className="eyebrow">PRODUKT</div>}
        {isNorskFolkehjelp && isCol("belop") && (
          <div className="eyebrow text-right">BELØP</div>
        )}
        {isCol("status") && <div className="eyebrow">STATUS</div>}
      </div>

      {/* Body */}
      <div>
        {groupedSales.map((group, groupIndex) => {
          const isExpanded = expandedDates.has(group.date)
          return (
            <React.Fragment key={groupIndex}>
              {/* Group header */}
              <button
                type="button"
                onClick={() => toggleDate(group.date)}
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-ab-subtle hover:bg-ab-hover/60 border-b border-ab-line-1 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 text-ab-fg-3 transition-transform",
                      isExpanded && "rotate-90",
                    )}
                  />
                  <span className="eyebrow text-ab-fg-2">{group.date}</span>
                  <span className="eyebrow text-ab-fg-3">· {group.sales.length} SALG</span>
                </div>
                {isNorskFolkehjelp && (group.totalAmount ?? 0) > 0 && (
                  <span className="mono text-[12px] text-ab-fg-2">
                    {formatKr(group.totalAmount ?? 0)}
                  </span>
                )}
              </button>

              {/* Expanded rows */}
              <AnimatePresence initial={false}>
                {isExpanded &&
                  group.sales.map((sale, saleIndex) => {
                    const rowKey = `${groupIndex}-${saleIndex}`
                    const isSelected = selectedRows.has(rowKey)
                    const initials = getInitials(sale.seller)
                    const timeStr = new Date(sale.date).toLocaleTimeString("no-NO", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                    const stagger = reduce ? 0 : Math.min(saleIndex, 10) * 0.015
                    return (
                      <motion.div
                        key={rowKey}
                        layout={false}
                        initial={reduce ? false : { opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduce ? undefined : { opacity: 0, y: -2 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1], delay: stagger }}
                        className={cn(
                          "relative grid items-center px-4 border-b border-ab-line-1 transition-colors group/row",
                          isSelected ? "bg-ab-accent-soft" : "hover:bg-ab-hover/40",
                        )}
                        style={{ gridTemplateColumns: gridTemplate, minHeight: rowMinH }}
                      >
                        {/* Selected indicator (left edge) */}
                        {isSelected && (
                          <span
                            aria-hidden
                            className="absolute inset-y-0 left-0 w-0.5 bg-ab-accent"
                          />
                        )}
                        {isCol("select") && (
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleRow(rowKey)}
                              className="h-4 w-4 rounded border-ab-line accent-[var(--ab-accent-11)] cursor-pointer"
                              aria-label="Velg rad"
                            />
                          </div>
                        )}
                        {isCol("tid") && (
                          <div className="mono tabular text-[12px] text-ab-fg-2">{timeStr}</div>
                        )}
                        {isCol("ansatt") && (
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Mascot for the seller — falls back to initials disc
                                when sale row has no performance data attached.
                                See components/gamification/SmartAvatar.tsx. */}
                            <SmartAvatar
                              size="sm"
                              user={{ name: sale.seller, user_type: "employee" }}
                              showMoodIndicator
                            />
                            <div className="min-w-0">
                              <div className="text-[13px] text-ab-fg truncate">{sale.seller}</div>
                              <div className="text-[11px] text-ab-fg-3 truncate">—</div>
                            </div>
                          </div>
                        )}
                        {isCol("adresse") && (
                          <div className="min-w-0">
                            <div className="text-[13px] text-ab-fg-2 truncate">—</div>
                            <div className="text-[11px] text-ab-fg-3 truncate">—</div>
                          </div>
                        )}
                        {isCol("omrade") && <div className="text-[13px] text-ab-fg-3">—</div>}
                        {isCol("produkt") && (
                          <div className="text-[13px] text-ab-fg-2 truncate">
                            {sale.campaign_name}
                          </div>
                        )}
                        {isNorskFolkehjelp && isCol("belop") && (
                          <div className="mono tabular text-[12px] text-ab-fg text-right">
                            {sale.gavebelop !== null ? formatKr(sale.gavebelop) : "—"}
                          </div>
                        )}
                        {isCol("status") && (
                          <div>
                            <StatusPill tone="success">BEKREFTET</StatusPill>
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
              </AnimatePresence>
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
})

// Helper function to fetch sales data using the new unified API
async function fetchSalesData(
  campaignId: string,
  startDate?: string,
  endDate?: string,
): Promise<UnifiedSalesData[]> {
  try {
    const token = authService.getAccessToken()
    if (!token) {
      throw new Error("Ingen autentiseringstoken tilgjengelig")
    }

    const params = new URLSearchParams({
      campaign_id: campaignId,
    })

    if (startDate) {
      params.append("start_date", startDate)
    }
    if (endDate) {
      params.append("end_date", endDate)
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/sales-page/?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const responseData = await response.json()

    if (!Array.isArray(responseData)) {
      console.warn("Unexpected API response structure:", responseData)
      return []
    }

    console.log("Fetched sales data:", responseData)
    return responseData
  } catch (error) {
    console.error("Error fetching sales data:", error)
    throw new Error("Kunne ikke hente salgsdata for denne kampanjen.")
  }
}

export default function SalesScreen() {
  const [activeTab, setActiveTab] = useState("sales")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCampaign, setSelectedCampaignState] = useState("all")
  const [showStarted, setShowStarted] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([])
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
  })
  const [isAuthenticated, setIsAuthenticated] = useState(true) // DEMO: always authenticated
  const [registerSaleOpen, setRegisterSaleOpen] = useState(false)
  const [salesData, setSalesData] = useState<UnifiedSalesData[]>([])
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")
  const [currentCampaign, setCurrentCampaign] = useState<{ id: string; name: string } | null>(null)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  // Density + column visibility (persisted in localStorage)
  const [density, setDensityState] = useState<Density>("default")
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() =>
    COLUMNS.reduce<Record<string, boolean>>((acc, c) => ({ ...acc, [c.key]: true }), {}),
  )
  useEffect(() => {
    try {
      const d = localStorage.getItem("statistikk:density") as Density | null
      if (d === "compact" || d === "default" || d === "comfortable") setDensityState(d)
      const cols = localStorage.getItem("statistikk:cols")
      if (cols) setVisibleColumns((prev) => ({ ...prev, ...JSON.parse(cols) }))
    } catch {}
  }, [])
  const setDensity = (d: Density) => {
    setDensityState(d)
    try { localStorage.setItem("statistikk:density", d) } catch {}
  }
  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem("statistikk:cols", JSON.stringify(next)) } catch {}
      return next
    })
  }

  const isNorskFolkehjelp = currentCampaign?.name?.toLowerCase().trim() === "norsk folkehjelp"

  // DEMO MODE: authentication is hardcoded on; no token check.
  useEffect(() => {
    setIsAuthenticated(true)
  }, [])

  // Clear invalid campaign data on mount
  useEffect(() => {
    clearInvalidCampaignData()
  }, [])

  // Listen for localStorage changes to react to campaign changes from other components
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "selectedCampaign" || e.key === "currentCampaign") {
        const storedCampaign = getSelectedCampaign()
        if (storedCampaign) {
          console.log("Campaign changed via localStorage (storage event):", storedCampaign)
          setCurrentCampaign(storedCampaign)
          setSelectedCampaignState(storedCampaign.name)
        }
      }
    }

    const handleCustomStorageChange = (e: CustomEvent) => {
      if (e.detail?.key === "selectedCampaign" || e.detail?.key === "currentCampaign") {
        const storedCampaign = getSelectedCampaign()
        if (storedCampaign) {
          console.log("Campaign changed via localStorage (custom event):", storedCampaign)
          setCurrentCampaign(storedCampaign)
          setSelectedCampaignState(storedCampaign.name)
        }
      }
    }

    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("localStorageChange", handleCustomStorageChange as EventListener)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("localStorageChange", handleCustomStorageChange as EventListener)
    }
  }, [])

  // Debug effect to log campaign changes
  useEffect(() => {
    console.log("Current campaign changed:", currentCampaign)
    console.log("isNorskFolkehjelp:", isNorskFolkehjelp)
  }, [currentCampaign, isNorskFolkehjelp])

  // DEMO MODE: seed dummy campaigns instead of hitting the API.
  useEffect(() => {
    if (!isAuthenticated) return
    const demoCampaigns = [
      { id: "demo-camp-001", name: "Norsk Folkehjelp" },
      { id: "demo-camp-002", name: "Strømavtale Oslo Øst" },
      { id: "demo-camp-003", name: "Bredbånd Vinter 2026" },
      { id: "demo-camp-004", name: "NGO Campaign" },
    ]
    setCampaigns(demoCampaigns)
    const stored = getSelectedCampaign()
    const initial = stored && demoCampaigns.find((c) => c.id === stored.id)
      ? stored
      : demoCampaigns[0]
    setSelectedCampaign(initial)
    setSelectedCampaignState(initial.name)
    setCurrentCampaign(initial)
  }, [isAuthenticated])

  // DEMO MODE: generate dummy sales data instead of fetching from API.
  useEffect(() => {
    if (!isAuthenticated || campaigns.length === 0 || !currentCampaign) {
      setSalesData([])
      return
    }
    setLoading(true)
    setError(null)
    const sellers = [
      "Anna Berg", "Lars Holm", "Mia Solberg", "Erik Lund", "Nora Dahl",
      "Jonas Vik", "Ida Aas", "Sondre Berg", "Kari Nilsen", "Petter Ruud",
      "Henrik Strand",
    ]
    const today = new Date()
    const rows: UnifiedSalesData[] = []
    // 90 dummy sales spread across last 30 days
    for (let i = 0; i < 90; i++) {
      const daysAgo = Math.floor(Math.random() * 30)
      const d = new Date(today)
      d.setDate(d.getDate() - daysAgo)
      d.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0, 0)
      const seller = sellers[Math.floor(Math.random() * sellers.length)]
      const amount = isNorskFolkehjelp
        ? null
        : [2490, 3290, 3990, 4290, 4990, 5490, 6290, 7490][Math.floor(Math.random() * 8)]
      rows.push({
        seller,
        campaign_name: currentCampaign.name,
        date: d.toISOString(),
        gavebelop: amount,
      })
    }
    // Brief simulated loading so the UI shows its loading state.
    const t = setTimeout(() => {
      setSalesData(rows)
      setLoading(false)
    }, 200)
    return () => clearTimeout(t)
  }, [isAuthenticated, campaigns, currentCampaign, startDate, endDate, isNorskFolkehjelp])

  // Frontend date and search filtering for sales data
  const getFilteredData = () => {
    return salesData.filter((item) => {
      if (startDate && new Date(item.date) < new Date(startDate)) return false
      if (endDate && new Date(item.date) > new Date(endDate)) return false

      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        const sellerName = item.seller
        if (
          !item.campaign_name.toLowerCase().includes(search) &&
          !sellerName.toLowerCase().includes(search)
        ) {
          return false
        }
      }
      return true
    })
  }

  // Sort filtered data by date
  const getSortedData = () => {
    const filteredData = getFilteredData()

    return [...filteredData].sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB
    })
  }

  const sortedSalesData = useMemo(() => {
    return getSortedData()
  }, [salesData, sortOrder, startDate, endDate, searchTerm])

  // Aggregate metrics
  const aggregates = useMemo(() => {
    const todayStr = new Date().toLocaleDateString("no-NO")
    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(now.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    let todayCount = 0
    let weekCount = 0
    let sumWithAmount = 0
    let countWithAmount = 0

    // Build per-day buckets for last 7 days
    const dayBuckets: Record<string, number> = {}
    for (let i = 0; i < 7; i++) {
      const d = new Date(now)
      d.setDate(now.getDate() - (6 - i))
      const key = d.toLocaleDateString("no-NO")
      dayBuckets[key] = 0
    }

    let visibleSum = 0
    for (const item of sortedSalesData) {
      const itemDate = new Date(item.date)
      const itemDateStr = itemDate.toLocaleDateString("no-NO")
      if (itemDateStr === todayStr) todayCount++
      if (itemDate >= sevenDaysAgo) {
        weekCount++
        if (dayBuckets[itemDateStr] !== undefined) dayBuckets[itemDateStr]++
      }
      if (item.gavebelop !== null && item.gavebelop !== undefined) {
        sumWithAmount += item.gavebelop
        countWithAmount++
        visibleSum += item.gavebelop
      }
    }

    const avg = countWithAmount > 0 ? sumWithAmount / countWithAmount : 0
    const sparkData = Object.values(dayBuckets)

    return {
      todayCount,
      weekCount,
      avg,
      visibleSum,
      sparkData,
    }
  }, [sortedSalesData])

  // Handle campaign selection
  const handleCampaignChange = (campaignName: string) => {
    console.log("handleCampaignChange called with:", campaignName)

    if (campaignName === "all") {
      console.log('Setting campaign to "all"')
      setSelectedCampaignState("all")
      setCurrentCampaign(null)
      localStorage.removeItem("selectedCampaign")
      return
    }

    const selectedCampaignObj = campaigns.find((c) => c.name === campaignName)
    console.log("Found campaign object:", selectedCampaignObj)

    if (selectedCampaignObj) {
      console.log("Setting campaign to:", selectedCampaignObj)
      setSelectedCampaignState(campaignName)
      setCurrentCampaign(selectedCampaignObj)
      setSelectedCampaign(selectedCampaignObj)

      window.dispatchEvent(
        new CustomEvent("localStorageChange", {
          detail: { key: "selectedCampaign", value: selectedCampaignObj },
        }),
      )
    } else {
      console.warn("Campaign not found:", campaignName)
    }
  }

  // Handle date column sorting
  const handleDateSort = useCallback(() => {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))
  }, [])

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setStartDate("")
    setEndDate("")
    setSearchTerm("")
  }, [])

  // Periode label
  const periodeLabel = useMemo(() => {
    if (startDate && endDate) return `${startDate} – ${endDate}`
    if (startDate) return `Fra ${startDate}`
    if (endDate) return `Til ${endDate}`
    return "Alle"
  }, [startDate, endDate])

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return <LoginPrompt onLoginSuccess={() => setIsAuthenticated(true)} />
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-ab-base text-ab-fg bg-page-glow">
      {/* Atmospheric dotted grid — sits behind content, faint */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.035] dark:opacity-[0.06]"
        style={{
          maskImage: "linear-gradient(to bottom, black, transparent 70%)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent 70%)",
        }}
      />

      {isNorskFolkehjelp && (
        <RegisterSalePopup open={registerSaleOpen} onClose={() => setRegisterSaleOpen(false)} />
      )}

      <div className="relative z-10">
      <PageHeader
        eyebrow="OPERASJONELL LOGG · DIREKTE OPPDATERT"
        title="Salg"
        description="Administrer dine salg og aktiviteter på tvers av kampanjer"
        action={
          <div className="flex items-center gap-2">
            <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
              <SheetTrigger asChild>
                <button type="button" className="ab-btn">
                  <Filter className="h-3.5 w-3.5" />
                  <span>Filter</span>
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[360px] sm:w-[420px]">
                <SheetHeader>
                  <SheetTitle>Filtre</SheetTitle>
                </SheetHeader>
                <div className="space-y-5 mt-6">
                  <div className="space-y-2">
                    <div className="eyebrow">PERIODE</div>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="ab-input h-9 text-sm"
                      />
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="ab-input h-9 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="eyebrow">KAMPANJE</div>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => handleCampaignChange("all")}
                        className={cn(
                          "text-left px-2 py-1.5 rounded-ab-md text-sm hover:bg-ab-hover",
                          selectedCampaign === "all" && "bg-ab-active text-ab-fg",
                        )}
                      >
                        Alle kampanjer
                      </button>
                      {campaigns.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleCampaignChange(c.name)}
                          className={cn(
                            "text-left px-2 py-1.5 rounded-ab-md text-sm hover:bg-ab-hover",
                            selectedCampaign === c.name && "bg-ab-active text-ab-fg",
                          )}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="eyebrow">SØK</div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ab-fg-3 pointer-events-none z-10" />
                      <Input
                        type="search"
                        placeholder="Søk etter navn..."
                        className="ab-input h-9 text-sm"
                        style={{ paddingLeft: 36 }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  <button onClick={handleClearFilters} className="ab-btn ghost w-full">
                    <X className="h-3.5 w-3.5" />
                    Nullstill filtre
                  </button>
                </div>
              </SheetContent>
            </Sheet>

            <button type="button" className="ab-btn">
              <Download className="h-3.5 w-3.5" />
              <span>Eksport CSV</span>
            </button>

            {isNorskFolkehjelp && (
              <button
                type="button"
                className="ab-btn primary"
                onClick={() => setRegisterSaleOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Logg salg</span>
                <span className="kbd ml-1">⌘N</span>
              </button>
            )}
          </div>
        }
      />
      </div>

      <div className="relative z-10 flex-1 px-4 md:px-6 py-5 space-y-4">
        {/* Filter chip row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Periode chip */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-ab-line hover:border-ab-line-2 bg-ab-elevated text-[12px] transition-colors"
              >
                <Calendar className="h-3 w-3 text-ab-fg-3" />
                <span className="text-ab-fg-3">Periode:</span>
                <span className="text-ab-fg font-medium">{periodeLabel}</span>
                <ChevronDown className="h-3 w-3 text-ab-fg-3 ml-0.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="start">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="eyebrow block">FRA</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="ab-input h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="eyebrow block">TIL</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="ab-input h-9 text-sm"
                  />
                </div>
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate("")
                      setEndDate("")
                    }}
                    className="ab-btn ghost w-full text-xs"
                  >
                    <X className="h-3 w-3" />
                    Nullstill periode
                  </button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Kampanje chip */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-ab-line hover:border-ab-line-2 bg-ab-elevated text-[12px] transition-colors"
              >
                <Tag className="h-3 w-3 text-ab-fg-3" />
                <span className="text-ab-fg-3">Kampanje:</span>
                <span className="text-ab-fg font-medium truncate max-w-[140px]">
                  {selectedCampaign === "all" ? "Alle" : selectedCampaign}
                </span>
                <ChevronDown className="h-3 w-3 text-ab-fg-3 ml-0.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-1" align="start">
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => handleCampaignChange("all")}
                  className={cn(
                    "text-left px-2 py-1.5 rounded-ab-md text-sm hover:bg-ab-hover",
                    selectedCampaign === "all" && "bg-ab-active text-ab-fg",
                  )}
                >
                  Alle kampanjer
                </button>
                {campaigns.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleCampaignChange(c.name)}
                    className={cn(
                      "text-left px-2 py-1.5 rounded-ab-md text-sm hover:bg-ab-hover",
                      selectedCampaign === c.name && "bg-ab-active text-ab-fg",
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Søk chip / input */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-ab-line hover:border-ab-line-2 bg-ab-elevated text-[12px] transition-colors"
              >
                <Search className="h-3 w-3 text-ab-fg-3" />
                <span className="text-ab-fg-3">Søk:</span>
                <span className="text-ab-fg font-medium truncate max-w-[120px]">
                  {searchTerm || "Alle"}
                </span>
                <ChevronDown className="h-3 w-3 text-ab-fg-3 ml-0.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ab-fg-3 pointer-events-none z-10" />
                <Input
                  type="search"
                  placeholder="Søk etter navn..."
                  className="ab-input h-9 text-sm"
                  style={{ paddingLeft: 32 }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>
            </PopoverContent>
          </Popover>

          {/* + Filter placeholder chip */}
          <button
            type="button"
            className="inline-flex items-center gap-1 h-8 px-3 rounded-full border border-dashed border-ab-line hover:border-ab-line-2 text-ab-fg-3 hover:text-ab-fg text-[12px] transition-colors"
          >
            <Plus className="h-3 w-3" />
            Filter
          </button>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          {/* Left: sales table inside a premium elevated card */}
          <div className="card-premium overflow-hidden">
            {/* Unified toolbar strip — h-12, results + show-all left of separator, density/columns right */}
            <div className="h-12 px-4 flex items-center gap-3 border-b border-ab-line-1 bg-ab-elevated/40">
              <span className="mono text-[12px] text-ab-fg-3 tabular">
                {nfNb.format(sortedSalesData.length)} resultater
              </span>
              <label className="flex items-center gap-2 text-[12px] text-ab-fg-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showStarted}
                  onChange={() => setShowStarted(!showStarted)}
                  className="h-3.5 w-3.5 rounded border-ab-line accent-[var(--ab-accent-11)] cursor-pointer"
                />
                Vis alle resultater
              </label>

              <div className="ml-auto flex items-center gap-1.5">
                <span aria-hidden className="h-5 w-px bg-ab-line-1" />
                {/* Density */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 h-7 px-2 rounded-ab-md border border-ab-line bg-ab-elevated text-[11px] text-ab-fg-3 hover:text-ab-fg hover:border-ab-line-2 transition-colors"
                      aria-label="Endre tetthet"
                    >
                      <Rows3 className="h-3 w-3" />
                      <span className="uppercase tracking-wider">{DENSITY_LABEL[density]}</span>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[160px]">
                    <DropdownMenuLabel className="eyebrow">Tetthet</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {(["compact", "default", "comfortable"] as Density[]).map((d) => (
                      <DropdownMenuItem
                        key={d}
                        onSelect={() => setDensity(d)}
                        className="cursor-pointer"
                      >
                        <span className="flex-1">{DENSITY_LABEL[d]}</span>
                        {density === d && <Check className="h-3.5 w-3.5 text-ab-accent" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Column visibility */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 h-7 px-2 rounded-ab-md border border-ab-line bg-ab-elevated text-[11px] text-ab-fg-3 hover:text-ab-fg hover:border-ab-line-2 transition-colors"
                      aria-label="Velg kolonner"
                    >
                      <Columns3 className="h-3 w-3" />
                      <span className="uppercase tracking-wider">Kolonner</span>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[180px]">
                    <DropdownMenuLabel className="eyebrow">Synlige kolonner</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {COLUMNS.filter((c) => c.key !== "belop" || isNorskFolkehjelp).map((c) => (
                      <DropdownMenuCheckboxItem
                        key={c.key}
                        checked={visibleColumns[c.key] !== false}
                        onCheckedChange={() => !c.always && toggleColumn(c.key)}
                        disabled={c.always}
                        className="cursor-pointer"
                      >
                        {c.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <SalesTable
              salesData={sortedSalesData}
              loading={loading}
              error={error}
              sortOrder={sortOrder}
              onDateSort={handleDateSort}
              isNorskFolkehjelp={isNorskFolkehjelp}
              startDate={startDate}
              endDate={endDate}
              searchTerm={searchTerm}
              onClearFilters={handleClearFilters}
              density={density}
              visibleColumns={visibleColumns}
            />
          </div>

          {/* Right: aggregate panel (sticky within page scroll) */}
          <aside className="card-premium p-5 h-fit lg:sticky lg:top-20">
            <div className="flex items-center justify-between mb-3">
              <div className="eyebrow">AGGREGAT</div>
            </div>
            <div className="space-y-0">
              <div className="py-3 border-b border-ab-line-1">
                <div className="eyebrow mb-1.5">I DAG</div>
                <div className="text-[28px] font-semibold tracking-tight text-ab-fg leading-none tabular">
                  <CountUp value={aggregates.todayCount} format={(n) => nfNb.format(n)} />
                </div>
              </div>
              <div className="py-3 border-b border-ab-line-1">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="eyebrow">DENNE UKEN</div>
                  <div
                    className="opacity-90"
                    style={{ filter: "drop-shadow(0 0 4px color-mix(in srgb, var(--ab-accent-9) 40%, transparent))" }}
                  >
                    <Sparkline data={aggregates.sparkData} width={64} height={20} />
                  </div>
                </div>
                <div className="text-[28px] font-semibold tracking-tight text-ab-fg leading-none tabular">
                  <CountUp value={aggregates.weekCount} format={(n) => nfNb.format(n)} />
                </div>
              </div>
              {isNorskFolkehjelp && (
                <>
                  <div className="py-3 border-b border-ab-line-1">
                    <div className="eyebrow mb-1.5">SNITT-BELØP</div>
                    <div className="text-[28px] font-semibold tracking-tight text-ab-fg leading-none tabular">
                      {aggregates.avg > 0 ? (
                        <CountUp value={aggregates.avg} format={(n) => formatKr(n)} />
                      ) : (
                        <span className="mono text-[18px] text-ab-fg-3">—</span>
                      )}
                    </div>
                  </div>
                  <div className="py-3">
                    <div className="eyebrow mb-1.5">SUM I VISNING</div>
                    <div className="text-[28px] font-semibold tracking-tight text-ab-fg leading-none tabular">
                      {aggregates.visibleSum > 0 ? (
                        <CountUp value={aggregates.visibleSum} format={(n) => formatKr(n)} />
                      ) : (
                        <span className="mono text-[18px] text-ab-fg-3">—</span>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-ab-line-1 flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-ab-success"
                style={{
                  animation: "ab-pulse-live 1.6s ease-in-out infinite",
                }}
              />
              <span className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-medium">
                Oppdatert nå
              </span>
            </div>
          </aside>
        </div>

        {/* Pagination footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 pt-2">
          <div className="text-[12px] text-ab-fg-3 text-center sm:text-left">
            Viser{" "}
            <span className="mono text-ab-fg-2">{nfNb.format(sortedSalesData.length)}</span> av{" "}
            <span className="mono text-ab-fg-2">{nfNb.format(pagination.totalCount)}</span>{" "}
            resultater
          </div>
          <div className="flex items-center justify-center sm:justify-end gap-2">
            <button
              type="button"
              disabled={pagination.currentPage <= 1}
              onClick={() =>
                setPagination((prev) => ({ ...prev, currentPage: prev.currentPage - 1 }))
              }
              className="ab-btn ghost disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Forrige
            </button>
            {pagination.totalPages > 1 && (
              <div className="hidden sm:flex items-center gap-1 px-3 h-8 mono text-[12px] text-ab-fg-3 bg-ab-subtle rounded-ab-md border border-ab-line-1">
                <span>{pagination.currentPage}</span>
                <span>/</span>
                <span>{pagination.totalPages}</span>
              </div>
            )}
            <button
              type="button"
              disabled={pagination.currentPage >= pagination.totalPages}
              onClick={() =>
                setPagination((prev) => ({ ...prev, currentPage: prev.currentPage + 1 }))
              }
              className="ab-btn ghost disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Neste
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Calendar, DollarSign, Phone, Clock, BarChart2, ListFilter, RefreshCw } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  Line,
  LineChart as RechartsLineChart,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"


import { fetchPerformance, fetchCampaigns, fetchConversion, PerformanceData, CampaignData, ConversionData } from "./services/chartDataService"
import { Campaign } from "./services/campaignService"
import { useDashboardData } from "./hooks/useDashboardData"
import { DashboardCards } from "./components/DashboardCards"
import { DashboardFilters } from "./components/DashboardFilters"

const COLORS = ["#0088FE", "#00C49F", "#FFBB28"]

export default function Dashboard() {
  const router = useRouter()
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([])
  const [campaignData, setCampaignData] = useState<CampaignData[]>([])
  const [conversionData, setConversionData] = useState<ConversionData[]>([])
  
  // Use the custom hook for real data
  const {
    activitiesSummary,
    selectedCampaign,
    loading,
    error,
    selectedDateRange,
    updateDateRange,
    refreshData,
    updateFilters
  } = useDashboardData()

  const handleFiltersChange = (filters: {
    date_range?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
    employee_id?: string;
  }) => {
    // Update the date range if provided
    if (filters.date_range) {
      updateDateRange(filters.date_range);
    }
    
    // Handle additional filters
    const additionalFilters: any = {};
    if (filters.status && filters.status !== 'all') additionalFilters.status = filters.status;
    if (filters.employee_id) additionalFilters.employee_id = filters.employee_id;
    if (filters.start_date) additionalFilters.start_date = filters.start_date;
    if (filters.end_date) additionalFilters.end_date = filters.end_date;
    
    console.log('Filters changed, will updateFilters with:', additionalFilters);
    if (Object.keys(additionalFilters).length > 0) {
      updateFilters(additionalFilters);
    }
  };

  useEffect(() => {
    fetchPerformance().then(setPerformanceData)
    fetchCampaigns().then(setCampaignData)
    fetchConversion().then(setConversionData)
  }, [])



  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <div className="flex-1 space-y-4 p-4 md:p-8">
        <div className="flex items-center justify-between space-y-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Mitt Dashbord</h2>
            <p className="text-muted-foreground">
              {selectedCampaign 
                ? `Velkommen tilbake! Her er din ytelsessoversikt for "${selectedCampaign.name}".`
                : "Velkommen tilbake! Velg en kampanje for å se din ytelsessoversikt."
              }
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <DashboardFilters onFiltersChange={handleFiltersChange} loading={loading} />
            <Button size="sm" className="h-8" onClick={refreshData} disabled={loading}>
              <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Oppdater
            </Button>
            <Button size="sm" className="h-8">
              <Calendar className="mr-2 h-3.5 w-3.5" />
              {new Date().toLocaleDateString('nb-NO', { 
                day: '2-digit', 
                month: 'short', 
                year: 'numeric' 
              })}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
            <DashboardCards 
              activitiesSummary={activitiesSummary}
              selectedCampaign={selectedCampaign}
              loading={loading}
              error={error}
            />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Dagens Ytelse</CardTitle>
                  <CardDescription>Oversikt over samtaler og treffrate</CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  {activitiesSummary?.trends?.daily_totals && activitiesSummary.trends.daily_totals.length > 0 ? (
                    <ChartContainer
                      config={{
                        totals: {
                          label: "Totale samtaler",
                          color: "hsl(var(--chart-1))",
                        },
                        hit_rates: {
                          label: "Treffrate (%)",
                          color: "hsl(var(--chart-2))",
                        },
                      }}
                      className="aspect-[4/3]"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsLineChart
                          data={activitiesSummary.trends?.daily_totals?.map((total, index) => ({
                            name: `Dag ${index + 1}`,
                            totals: total,
                            hit_rates: activitiesSummary.trends?.daily_hit_rates?.[index] || 0
                          })) || []}
                          margin={{
                            top: 5,
                            right: 10,
                            left: 10,
                            bottom: 0,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="name"
                            className="text-xs"
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            className="text-xs"
                            tickLine={false}
                            axisLine={false}
                          />
                          <ChartTooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="flex flex-col">
                                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                                          {payload[0]?.name}
                                        </span>
                                        <span className="font-bold text-muted-foreground">
                                          {payload[0]?.value}
                                        </span>
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                                          {payload[1]?.name}
                                        </span>
                                        <span className="font-bold">
                                          {payload[1]?.value}%
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )
                              }
                              return null
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="totals"
                            stroke="hsl(var(--chart-1))"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="hit_rates"
                            stroke="hsl(var(--chart-2))"
                            strokeWidth={2}
                            dot={false}
                          />
                        </RechartsLineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                      {loading ? 'Laster data...' : 'Ingen trenddata tilgjengelig'}
                    </div>
                  )}
                </CardContent>
              </Card>


            </div>
          </div>
      </div>
    </div>
  )
}

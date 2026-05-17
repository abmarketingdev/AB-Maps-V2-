"use client"

/**
 * Line Chart Component
 * 
 * Daily trends line chart showing contacts per day broken down by status.
 * Displays 4 lines: Ja, Nei, Ikke Hjemme, Følg Opp
 */

import React from 'react';
import { format } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardTrendsResponse } from '@/types/dashboard';

interface LineChartProps {
  trends: DashboardTrendsResponse | null;
  loading: boolean;
  className?: string;
}

// Color mapping for status lines
const STATUS_COLORS = {
  ja: '#10b981',           // green
  nei: '#ef4444',           // red
  ikke_hjemme: '#f59e0b',   // orange
  folg_opp: '#3b82f6'       // blue
};

// Status labels
const STATUS_LABELS = {
  ja: 'Ja',
  nei: 'Nei',
  ikke_hjemme: 'Ikke Hjemme',
  folg_opp: 'Følg Opp'
};

/**
 * Format date for display on X-axis
 */
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return format(date, 'MMM dd');
  } catch {
    return dateString;
  }
};

/**
 * Custom tooltip for line chart
 */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
        <p className="font-semibold mb-2">{format(new Date(label), 'MMM dd, yyyy')}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => {
            const statusKey = entry.dataKey as keyof typeof STATUS_LABELS;
            return (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {STATUS_LABELS[statusKey]}
                  </span>
                </div>
                <span className="font-medium">{entry.value}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

/**
 * Custom legend formatter
 */
const renderLegend = (props: any) => {
  const { payload } = props;
  
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
      {payload.map((entry: any, index: number) => {
        const statusKey = entry.value as keyof typeof STATUS_LABELS;
        return (
          <div key={`legend-${index}`} className="flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-muted-foreground">
              {STATUS_LABELS[statusKey]}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export function DashboardLineChart({ trends, loading, className }: LineChartProps) {
  // Loading state
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] sm:h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!trends || !trends.trends) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Dører banket per dag</CardTitle>
          <CardDescription>Daglig innsikt i banket dører</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[250px] sm:h-[300px] text-muted-foreground">
            <p>Ingen trenddata tilgjengelig</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { trends: trendsData } = trends;

  // Transform data for chart
  // All arrays have the same length, so we can use ja array as base
  const chartData = trendsData.ja.map((item, index) => ({
    date: item.date,
    dateFormatted: formatDate(item.date),
    ja: item.count,
    nei: trendsData.nei[index]?.count || 0,
    ikke_hjemme: trendsData.ikke_hjemme[index]?.count || 0,
    folg_opp: trendsData.folg_opp[index]?.count || 0
  }));

  // If no data, show empty state
  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Dører banket per dag</CardTitle>
          <CardDescription>Daglig innsikt i banket dører</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[250px] sm:h-[300px] text-muted-foreground">
            <p>Ingen trenddata tilgjengelig</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Dører banket per dag</CardTitle>
        <CardDescription>Daglig innsikt i banket dører</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="dateFormatted"
              tick={{ fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              height={60}
              className="text-muted-foreground sm:text-xs"
            />
            <YAxis
              tick={{ fontSize: 10 }}
              className="text-muted-foreground sm:text-xs"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={renderLegend} />
            <Line
              type="monotone"
              dataKey="ja"
              stroke={STATUS_COLORS.ja}
              strokeWidth={2}
              name="ja"
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="nei"
              stroke={STATUS_COLORS.nei}
              strokeWidth={2}
              name="nei"
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="ikke_hjemme"
              stroke={STATUS_COLORS.ikke_hjemme}
              strokeWidth={2}
              name="ikke_hjemme"
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="folg_opp"
              stroke={STATUS_COLORS.folg_opp}
              strokeWidth={2}
              name="folg_opp"
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default DashboardLineChart;


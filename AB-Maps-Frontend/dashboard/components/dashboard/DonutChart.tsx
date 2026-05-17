"use client"

/**
 * Donut Chart Component
 * 
 * Status breakdown donut chart showing distribution of contact statuses.
 * Uses Recharts PieChart with innerRadius for donut effect.
 */

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardStatsResponse } from '@/types/dashboard';
import { useIsMobile } from '@/hooks/use-mobile';

interface DonutChartProps {
  stats: DashboardStatsResponse | null;
  loading: boolean;
  className?: string;
}

// Color mapping for status segments
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
 * Custom tooltip for donut chart
 */
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const { name, value, payload: dataPayload } = data;
    
    return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
        <p className="font-semibold mb-1">{STATUS_LABELS[name as keyof typeof STATUS_LABELS]}</p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">{value.toFixed(1)}%</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {dataPayload.count} kontakter
        </p>
      </div>
    );
  }
  return null;
};

/**
 * Custom legend formatter
 */
const renderLegend = (props: any, chartData: any[]) => {
  const { payload } = props;
  
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
      {payload.map((entry: any, index: number) => {
        const statusKey = entry.value as keyof typeof STATUS_LABELS;
        // Find the corresponding data item from chartData
        const dataItem = chartData.find(item => item.name === statusKey);
        // Use the value directly from chartData (which is already a percentage)
        const percentage = dataItem?.value ?? 0;
        
        return (
          <div key={`legend-${index}`} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-muted-foreground">
              {STATUS_LABELS[statusKey]} ({percentage.toFixed(1)}%)
            </span>
          </div>
        );
      })}
    </div>
  );
};

export function DonutChart({ stats, loading, className }: DonutChartProps) {
  const isMobile = useIsMobile();
  
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
  if (!stats || !stats.status_percentages || !stats.status_counts) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Diagram oversikt over totale pitcher</CardTitle>
          <CardDescription>Fordeling av de ulike segmentene</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[250px] sm:h-[300px] text-muted-foreground">
            <p>Ingen data tilgjengelig</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { status_percentages, status_counts } = stats;

  // Prepare data for chart
  const chartData = [
    {
      name: 'ja',
      value: status_percentages.ja,
      count: status_counts.ja,
      color: STATUS_COLORS.ja
    },
    {
      name: 'nei',
      value: status_percentages.nei,
      count: status_counts.nei,
      color: STATUS_COLORS.nei
    },
    {
      name: 'ikke_hjemme',
      value: status_percentages.ikke_hjemme,
      count: status_counts.ikke_hjemme,
      color: STATUS_COLORS.ikke_hjemme
    },
    {
      name: 'folg_opp',
      value: status_percentages.folg_opp,
      count: status_counts.folg_opp,
      color: STATUS_COLORS.folg_opp
    }
  ].filter(item => item.value > 0); // Filter out zero values

  // If no data, show empty state
  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Diagram oversikt over totale pitcher</CardTitle>
          <CardDescription>Fordeling av de ulike segmentene</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[250px] sm:h-[300px] text-muted-foreground">
            <p>Ingen statusdata tilgjengelig</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Diagram oversikt over totale pitcher</CardTitle>
        <CardDescription>Fordeling av de ulike segmentene</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={isMobile ? 50 : 60}
              outerRadius={isMobile ? 80 : 100}
              paddingAngle={2}
              dataKey="value"
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={(props) => renderLegend(props, chartData)} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default DonutChart;


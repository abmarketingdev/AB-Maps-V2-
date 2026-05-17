"use client"

/**
 * KPI Card Component
 * 
 * Individual KPI card component displaying a single metric.
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'purple' | 'orange';
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
  className?: string;
}

const colorClasses = {
  blue: {
    icon: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200'
  },
  green: {
    icon: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200'
  },
  purple: {
    icon: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200'
  },
  orange: {
    icon: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200'
  }
};

export function KPICard({
  title,
  value,
  icon: Icon,
  color = 'blue',
  subtitle,
  trend,
  className
}: KPICardProps) {
  const colors = colorClasses[color];

  return (
    <Card className={cn("hover:shadow-md transition-shadow", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn("p-2 rounded-md", colors.bg)}>
          <Icon className={cn("h-4 w-4", colors.icon)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <div className="text-xl sm:text-2xl font-bold">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground">
              {subtitle}
            </p>
          )}
          {trend && (
            <div className="flex items-center gap-1 text-xs">
              <span className={cn(
                "font-medium",
                trend.isPositive ? "text-green-600" : "text-red-600"
              )}>
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-muted-foreground">
                {trend.label}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default KPICard;


"use client";

import React, { useState } from 'react';
import { AdminAssignedTask, AdminTaskFilters } from '@/types/todo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Search, 
  ArrowUpDown, 
  Calendar,
  Users,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
// Date formatting helper
const formatDate = (dateString: string | null) => {
  if (!dateString) return 'Ingen frist';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('nb-NO', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch {
    return dateString;
  }
};

interface AdminTaskListProps {
  tasks: AdminAssignedTask[];
  loading?: boolean;
  onTaskClick: (task: AdminAssignedTask) => void;
  filters: AdminTaskFilters;
  onFiltersChange: (filters: AdminTaskFilters) => void;
}

export function AdminTaskList({
  tasks = [],
  loading = false,
  onTaskClick,
  filters,
  onFiltersChange,
}: AdminTaskListProps) {
  const isMobile = useIsMobile();
  
  // Safety check
  const safeTasks = tasks || [];

  const handleFilterChange = (key: keyof AdminTaskFilters, value: string | undefined) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'Høy';
      case 'medium':
        return 'Middels';
      case 'low':
        return 'Lav';
      default:
        return priority;
    }
  };


  if (isMobile) {
    return (
      <div className="space-y-4">
        {/* Mobile Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtre</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Søk oppgaver..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Prioritet</label>
                <Select
                  value={filters.priority || 'all'}
                  onValueChange={(value) => 
                    handleFilterChange('priority', value === 'all' ? undefined : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="high">Høy</SelectItem>
                    <SelectItem value="medium">Middels</SelectItem>
                    <SelectItem value="low">Lav</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sorter</label>
                <Select
                  value={filters.ordering || 'created_at'}
                  onValueChange={(value) => handleFilterChange('ordering', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">Nyeste</SelectItem>
                    <SelectItem value="-created_at">Eldste</SelectItem>
                    <SelectItem value="deadline">Frist (Stigende)</SelectItem>
                    <SelectItem value="-deadline">Frist (Synkende)</SelectItem>
                    <SelectItem value="priority">Prioritet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mobile Task Cards */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Laster oppgaver...</div>
        ) : safeTasks.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Ingen oppgaver funnet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {safeTasks.map((task) => (
              <Card
                key={task.id}
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => onTaskClick(task)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-base">{task.title}</h3>
                    <Badge variant={getPriorityBadgeVariant(task.priority)}>
                      {getPriorityLabel(task.priority)}
                    </Badge>
                  </div>
                  
                  {task.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {task.assigned_count} tildelt
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {task.completed_count} fullført
                    </div>
                    {task.deadline && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(task.deadline)}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Fullføring</span>
                      <span className="font-medium">{task.completion_percentage.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${task.completion_percentage}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Desktop View
  return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Admin oppgaver</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Søk oppgaver..."
                  value={filters.search || ''}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              <Select
                value={filters.priority || 'all'}
                onValueChange={(value) => 
                  handleFilterChange('priority', value === 'all' ? undefined : value)
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Prioritet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle prioriteringer</SelectItem>
                  <SelectItem value="high">Høy</SelectItem>
                  <SelectItem value="medium">Middels</SelectItem>
                  <SelectItem value="low">Lav</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.ordering || 'created_at'}
                onValueChange={(value) => handleFilterChange('ordering', value)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sorter etter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Nyeste først</SelectItem>
                  <SelectItem value="-created_at">Eldste først</SelectItem>
                  <SelectItem value="deadline">Frist (Stigende)</SelectItem>
                  <SelectItem value="-deadline">Frist (Synkende)</SelectItem>
                  <SelectItem value="priority">Prioritet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Laster oppgaver...</div>
          ) : safeTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Ingen oppgaver funnet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tittel</TableHead>
                <TableHead>Prioritet</TableHead>
                <TableHead>Frist</TableHead>
                <TableHead>Tildelt</TableHead>
                <TableHead>Fullført</TableHead>
                <TableHead>Fremgang</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {safeTasks.map((task) => (
                <TableRow
                  key={task.id}
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => onTaskClick(task)}
                >
                  <TableCell className="font-medium max-w-xs">
                    <div className="truncate">{task.title}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getPriorityBadgeVariant(task.priority)}>
                      {getPriorityLabel(task.priority)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {task.deadline ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {formatDate(task.deadline)}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Ingen frist</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{task.assigned_count}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      <span>{task.completed_count}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="w-24">
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${task.completion_percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {task.completion_percentage.toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {task.is_fully_completed ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Fullført
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Pågår
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

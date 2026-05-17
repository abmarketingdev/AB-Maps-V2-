"use client";

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Search,
  X,
  AlertTriangle,
  Calendar as CalendarIcon,
  Flag,
  CheckCircle2,
  Eye,
  ChevronDown,
  Check as CheckIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TodoFiltersData {
  search: string;
  status: string;
  priority: string;
  showOverdue: boolean;
  showToday: boolean;
  adminAssigned?: 'all' | 'admin' | 'personal';
}

interface TodoFiltersProps {
  filters: TodoFiltersData;
  onFiltersChange: (filters: TodoFiltersData) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Alle statuser' },
  { value: 'pending', label: 'Venter' },
  { value: 'in_progress', label: 'Pågår' },
  { value: 'completed', label: 'Ferdig' },
];

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Alle prioriteter' },
  { value: 'high', label: 'Høy' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Lav' },
];

const SCOPE_OPTIONS: { value: 'all' | 'admin' | 'personal'; label: string }[] = [
  { value: 'all', label: 'Alle oppgaver' },
  { value: 'admin', label: 'Tildelt av admin' },
  { value: 'personal', label: 'Kun mine' },
];

function FilterPill({
  label,
  value,
  icon: Icon,
  isActive,
  open,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  open?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-3 rounded-full',
        'border bg-ab-elevated text-[12px] transition-colors',
        'hover:border-ab-line-2 hover:bg-ab-hover',
        open
          ? 'ring-2 ring-ab-accent/15 border-ab-accent/30'
          : 'border-ab-line'
      )}
    >
      {isActive && (
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ab-accent shrink-0" />
      )}
      <Icon className="h-3 w-3 text-ab-fg-3" />
      <span className="text-[10px] uppercase tracking-wider text-ab-fg-3 font-semibold">
        {label}:
      </span>
      <span className="text-ab-fg font-medium truncate max-w-[140px]">{value}</span>
      <ChevronDown className="h-3 w-3 text-ab-fg-3" />
    </button>
  );
}

export function TodoFilters({
  filters,
  onFiltersChange,
  onClearFilters,
  hasActiveFilters,
}: TodoFiltersProps) {
  const [localSearch, setLocalSearch] = useState<string>(filters.search);
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);

  useEffect(() => {
    setLocalSearch(filters.search);
  }, [filters.search]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      if (localSearch !== filters.search) {
        onFiltersChange({ ...filters, search: localSearch });
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  const setStatus = (v: string) => {
    onFiltersChange({ ...filters, status: v });
    setStatusOpen(false);
  };
  const setPriority = (v: string) => {
    onFiltersChange({ ...filters, priority: v });
    setPriorityOpen(false);
  };
  const setScope = (v: 'all' | 'admin' | 'personal') => {
    onFiltersChange({ ...filters, adminAssigned: v });
    setScopeOpen(false);
  };

  const statusLabel =
    STATUS_OPTIONS.find(o => o.value === filters.status)?.label ?? 'Alle';
  const priorityLabel =
    PRIORITY_OPTIONS.find(o => o.value === filters.priority)?.label ?? 'Alle';
  const scopeLabel =
    SCOPE_OPTIONS.find(o => o.value === (filters.adminAssigned ?? 'all'))?.label ?? 'Alle';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search input — rounded-full, bg-subtle */}
      <div className="relative flex-1 min-w-[200px] max-w-[320px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ab-fg-3 pointer-events-none z-10" />
        <Input
          placeholder="Søk i oppgaver..."
          value={localSearch}
          onChange={e => setLocalSearch(e.target.value)}
          className="ab-input h-8 w-full text-[12px] rounded-full bg-ab-subtle border-ab-line hover:border-ab-line-2 focus:border-ab-accent transition-colors"
          style={{ paddingLeft: 32, paddingRight: localSearch ? 28 : 12 }}
        />
        {localSearch && (
          <button
            type="button"
            onClick={() => setLocalSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center text-ab-fg-3 hover:text-ab-fg rounded-full"
            aria-label="Nullstill søk"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Status filter */}
      <Popover open={statusOpen} onOpenChange={setStatusOpen}>
        <PopoverTrigger asChild>
          <span>
            <FilterPill
              label="Status"
              value={
                filters.status
                  ? STATUS_OPTIONS.find(o => o.value === filters.status)?.label ?? 'Alle'
                  : 'Alle'
              }
              icon={CheckCircle2}
              isActive={!!filters.status}
              open={statusOpen}
              onClick={() => setStatusOpen(o => !o)}
            />
          </span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-0 bg-ab-canvas border-ab-line">
          <Command className="bg-transparent">
            <CommandList>
              <CommandEmpty>Ingen valg.</CommandEmpty>
              <CommandGroup>
                {STATUS_OPTIONS.map(o => (
                  <CommandItem
                    key={o.value || 'all'}
                    value={o.label}
                    onSelect={() => setStatus(o.value)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <span className="text-[13px]">{o.label}</span>
                    {filters.status === o.value && (
                      <CheckIcon className="h-3.5 w-3.5 text-ab-accent" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Priority filter */}
      <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
        <PopoverTrigger asChild>
          <span>
            <FilterPill
              label="Prioritet"
              value={priorityLabel.replace(/^Alle.*$/, 'Alle')}
              icon={Flag}
              isActive={!!filters.priority}
              open={priorityOpen}
              onClick={() => setPriorityOpen(o => !o)}
            />
          </span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-0 bg-ab-canvas border-ab-line">
          <Command className="bg-transparent">
            <CommandList>
              <CommandEmpty>Ingen valg.</CommandEmpty>
              <CommandGroup>
                {PRIORITY_OPTIONS.map(o => (
                  <CommandItem
                    key={o.value || 'all'}
                    value={o.label}
                    onSelect={() => setPriority(o.value)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <span className="text-[13px]">{o.label}</span>
                    {filters.priority === o.value && (
                      <CheckIcon className="h-3.5 w-3.5 text-ab-accent" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Visning (scope: admin / personal / all) */}
      <Popover open={scopeOpen} onOpenChange={setScopeOpen}>
        <PopoverTrigger asChild>
          <span>
            <FilterPill
              label="Visning"
              value={scopeLabel}
              icon={Eye}
              isActive={!!filters.adminAssigned && filters.adminAssigned !== 'all'}
              open={scopeOpen}
              onClick={() => setScopeOpen(o => !o)}
            />
          </span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0 bg-ab-canvas border-ab-line">
          <Command className="bg-transparent">
            <CommandList>
              <CommandEmpty>Ingen valg.</CommandEmpty>
              <CommandGroup>
                {SCOPE_OPTIONS.map(o => (
                  <CommandItem
                    key={o.value}
                    value={o.label}
                    onSelect={() => setScope(o.value)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <span className="text-[13px]">{o.label}</span>
                    {(filters.adminAssigned ?? 'all') === o.value && (
                      <CheckIcon className="h-3.5 w-3.5 text-ab-accent" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Quick toggle: Forsinket */}
      <button
        type="button"
        onClick={() =>
          onFiltersChange({ ...filters, showOverdue: !filters.showOverdue })
        }
        className={cn(
          'inline-flex items-center gap-1.5 h-8 px-3 rounded-full',
          'border text-[12px] transition-colors',
          filters.showOverdue
            ? 'bg-ab-danger-bg text-ab-danger border-ab-danger/30 ring-2 ring-ab-danger/15'
            : 'bg-ab-elevated text-ab-fg-2 border-ab-line hover:border-ab-line-2 hover:text-ab-fg'
        )}
        title="Vis kun forsinkede oppgaver"
      >
        <AlertTriangle className="h-3 w-3" />
        <span>Forsinket</span>
      </button>

      {/* Quick toggle: I dag */}
      <button
        type="button"
        onClick={() =>
          onFiltersChange({ ...filters, showToday: !filters.showToday })
        }
        className={cn(
          'inline-flex items-center gap-1.5 h-8 px-3 rounded-full',
          'border text-[12px] transition-colors',
          filters.showToday
            ? 'bg-ab-accent/10 text-ab-accent border-ab-accent/30 ring-2 ring-ab-accent/15'
            : 'bg-ab-elevated text-ab-fg-2 border-ab-line hover:border-ab-line-2 hover:text-ab-fg'
        )}
        title="Vis kun oppgaver med frist i dag"
      >
        <CalendarIcon className="h-3 w-3" />
        <span>I dag</span>
      </button>

      {/* Clear */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="ab-btn ghost ml-auto"
        >
          <X className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Tilbakestill filtre</span>
        </button>
      )}
    </div>
  );
}

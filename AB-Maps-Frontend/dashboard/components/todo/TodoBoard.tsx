"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  compareAsc,
  format,
} from 'date-fns';
import { nb } from 'date-fns/locale';
import { TodoColumn } from './TodoColumn';
import { TodoCard } from './TodoCard';
import { TodoModal } from './TodoModal';
import { CreateTodoForm } from './CreateTodoForm';
import { TodoFilters, TodoFiltersData } from './TodoFilters';
import { TodoBulkActions } from './TodoBulkActions';
import { fetchTodos, getTodoStats, updateTodo, bulkCompleteTodos, bulkDeleteTodos } from '@/services/todoService';
import { Todo, TodoStats } from '@/types/todo';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deleteTodo } from '@/services/todoService';
import { RefreshCw, Plus, Inbox, Shield, ChevronLeft, ChevronRight, Flame, X, ArrowRight, Check, Pencil, MoreHorizontal } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/lib/auth/AuthContext';
import { PageHeader, StatusPill } from '@/components/ui-ab';

interface TodoBoardProps {
  // Props for future customization
}

type TabKey = 'active' | 'today' | 'overdue' | 'completed' | 'all';

const PRIORITY_LABEL_NB: Record<'low' | 'medium' | 'high', string> = {
  low: 'LAV',
  medium: 'MEDIUM',
  high: 'HØY',
};

const PRIORITY_TONE: Record<'low' | 'medium' | 'high', 'info' | 'warn' | 'danger'> = {
  low: 'info',
  medium: 'warn',
  high: 'danger',
};

function getInitials(name: string | null | undefined): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function TodoBoard({}: TodoBoardProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filteredTodos, setFilteredTodos] = useState<Todo[]>([]);
  const [stats, setStats] = useState<TodoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTodo, setActiveTodo] = useState<Todo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Modal state
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Create form state
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);

  // Mobile optimization
  const isMobile = useIsMobile();

  // Auth (for admin info banner)
  const { isAdmin } = useAuth();

  // Row-action delete confirm
  const [rowDeleteConfirmTodo, setRowDeleteConfirmTodo] = useState<Todo | null>(null);

  // Dismissible admin banner — persists per browser session
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('dismissed:tildel-banner') === '1';
    } catch {
      return false;
    }
  });

  // Active tab state
  const [activeTab, setActiveTab] = useState<TabKey>('active');

  // Date filter for calendar click
  const [calendarFocusDate, setCalendarFocusDate] = useState<Date | null>(null);

  // Calendar navigation
  const [viewMonth, setViewMonth] = useState<Date>(() => new Date());

  // Advanced features state
  const [selectedTodoIds, setSelectedTodoIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<TodoFiltersData>({
    search: '',
    status: '',
    priority: '',
    showOverdue: false,
    showToday: false,
    adminAssigned: 'all'
  });

  // Configure sensors for drag & drop
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  // Fetch TODOs on component mount and when filters change
  useEffect(() => {
    loadTodos();
  }, [filters]);

  const loadTodos = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build API filters from component filters
      const apiFilters: any = {};

      if (filters.status) {
        apiFilters.status = filters.status;
      }
      if (filters.priority) {
        apiFilters.priority = filters.priority;
      }
      if (filters.search) {
        apiFilters.search = filters.search;
      }

      // Handle admin assignment filter
      if (filters.adminAssigned === 'admin') {
        apiFilters.is_admin_assigned = true;
      } else if (filters.adminAssigned === 'personal') {
        apiFilters.is_admin_assigned = false;
      }
      // If 'all', don't include the filter

      const [todosData, statsData] = await Promise.all([
        fetchTodos(apiFilters),
        getTodoStats()
      ]);

      setTodos(todosData.results);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load TODOs');
      console.error('Error loading TODOs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const todo = todos.find(t => t.id === active.id);
    setActiveTodo(todo || null);
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveTodo(null);
      return;
    }

    const draggedTodo = todos.find(t => t.id === active.id);
    const overColumn = over.id as string;

    if (!draggedTodo) {
      setActiveTodo(null);
      return;
    }

    // Determine new status based on column
    let newStatus: 'pending' | 'in_progress' | 'completed';

    if (overColumn === 'todo-column') {
      newStatus = draggedTodo.status === 'completed' ? 'pending' : draggedTodo.status;
    } else if (overColumn === 'completed-column') {
      newStatus = 'completed';
    } else {
      setActiveTodo(null);
      return;
    }

    // Don't update if status hasn't changed
    if (draggedTodo.status === newStatus) {
      setActiveTodo(null);
      return;
    }

    try {
      setIsUpdating(true);

      // Update TODO status via API
      const updatedTodo = await updateTodo(draggedTodo.id, { status: newStatus });

      // Update local state
      setTodos(prevTodos =>
        prevTodos.map(todo =>
          todo.id === draggedTodo.id ? updatedTodo : todo
        )
      );

      // Refresh stats
      const statsData = await getTodoStats();
      setStats(statsData);

    } catch (error) {
      console.error('Error updating TODO:', error);
      // Could show toast notification here
    } finally {
      setIsUpdating(false);
      setActiveTodo(null);
    }
  };

  const handleTodoUpdate = (updatedTodo: Todo) => {
    // Update the todo in the list
    setTodos(prevTodos =>
      prevTodos.map(todo =>
        todo.id === updatedTodo.id ? updatedTodo : todo
      )
    );

    // Refresh stats
    getTodoStats().then(setStats).catch(console.error);
  };

  const handleTodoClick = (todo: Todo) => {
    setSelectedTodo(todo);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedTodo(null);
  };

  const handleTodoDelete = (todoId: string) => {
    setTodos(prevTodos => prevTodos.filter(todo => todo.id !== todoId));

    // Refresh stats
    getTodoStats().then(setStats).catch(console.error);
  };

  const handleCreateTodo = () => {
    setIsCreateFormOpen(true);
  };

  const handleCreateSuccess = async (newTodo: Todo | null) => {
    if (newTodo) {
      // Personal todo — append locally
      setTodos(prevTodos => [...prevTodos, newTodo]);
      getTodoStats().then(setStats).catch(console.error);
    } else {
      // Assignment — the backend created todos for other users.
      // Refresh the full list so any self-assignments show up.
      await loadTodos();
    }
  };

  const handleBulkComplete = async (todoIds: string[]) => {
    try {
      setIsUpdating(true);
      await bulkCompleteTodos(todoIds);
      await loadTodos();
      setSelectedTodoIds([]);
    } catch (error) {
      console.error('Error bulk completing TODOs:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBulkDelete = async (todoIds: string[]) => {
    try {
      setIsUpdating(true);
      await bulkDeleteTodos(todoIds);
      await loadTodos();
      setSelectedTodoIds([]);
    } catch (error) {
      console.error('Error bulk deleting TODOs:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      status: '',
      priority: '',
      showOverdue: false,
      showToday: false,
      adminAssigned: 'all'
    });
  };

  const hasActiveFilters =
    filters.search !== '' ||
    filters.status !== '' ||
    filters.priority !== '' ||
    filters.showOverdue ||
    filters.showToday ||
    (filters.adminAssigned && filters.adminAssigned !== 'all');

  // Apply filters
  useEffect(() => {
    let filtered = [...todos];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(todo =>
        todo.title.toLowerCase().includes(searchLower) ||
        (todo.description && todo.description.toLowerCase().includes(searchLower))
      );
    }

    // Status filter
    if (filters.status) {
      filtered = filtered.filter(todo => todo.status === filters.status);
    }

    // Priority filter
    if (filters.priority) {
      filtered = filtered.filter(todo => todo.priority === filters.priority);
    }

    // Overdue filter
    if (filters.showOverdue) {
      filtered = filtered.filter(todo => todo.is_overdue);
    }

    // Today filter
    if (filters.showToday) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      filtered = filtered.filter(todo => {
        if (!todo.deadline) return false;
        const deadline = new Date(todo.deadline);
        return deadline >= today && deadline < tomorrow;
      });
    }

    setFilteredTodos(filtered);
  }, [todos, filters]);

  // Tab counts (derived from filteredTodos)
  const tabCounts = useMemo(() => {
    const today = startOfDay(new Date());
    let active = 0;
    let todayCount = 0;
    let overdue = 0;
    let completed = 0;
    for (const t of filteredTodos) {
      if (t.status === 'completed') {
        completed++;
      } else {
        active++;
      }
      if (t.deadline) {
        const d = startOfDay(new Date(t.deadline));
        if (d.getTime() === today.getTime() && t.status !== 'completed') {
          todayCount++;
        }
      }
      if (t.is_overdue && t.status !== 'completed') {
        overdue++;
      }
    }
    return {
      active,
      today: todayCount,
      overdue,
      completed,
      all: filteredTodos.length,
    };
  }, [filteredTodos]);

  // Tab-filtered rows
  const tabFilteredTodos = useMemo(() => {
    const today = startOfDay(new Date());
    let rows = [...filteredTodos];

    // calendar focus date overrides tab if set
    if (calendarFocusDate) {
      const focus = startOfDay(calendarFocusDate);
      rows = rows.filter(t => {
        if (!t.deadline) return false;
        return startOfDay(new Date(t.deadline)).getTime() === focus.getTime();
      });
      return rows;
    }

    if (activeTab === 'active') {
      rows = rows.filter(t => t.status !== 'completed');
    } else if (activeTab === 'today') {
      rows = rows.filter(t => {
        if (!t.deadline) return false;
        return startOfDay(new Date(t.deadline)).getTime() === today.getTime();
      });
    } else if (activeTab === 'overdue') {
      rows = rows.filter(t => t.is_overdue && t.status !== 'completed');
    } else if (activeTab === 'completed') {
      rows = rows.filter(t => t.status === 'completed');
    }
    // 'all' = no filter
    return rows;
  }, [filteredTodos, activeTab, calendarFocusDate]);

  // Per-day deadline aggregation for the calendar (count + overdue flag + titles)
  const deadlineByDay = useMemo(() => {
    const m = new Map<string, { count: number; overdue: boolean; titles: string[] }>();
    const today = startOfDay(new Date());
    for (const t of todos) {
      if (!t.deadline) continue;
      const d = new Date(t.deadline);
      const key = d.toDateString();
      const isOverdue = startOfDay(d).getTime() < today.getTime() && t.status !== 'completed';
      const entry = m.get(key) ?? { count: 0, overdue: false, titles: [] };
      entry.count += 1;
      entry.overdue = entry.overdue || isOverdue;
      if (entry.titles.length < 4) entry.titles.push(t.title);
      m.set(key, entry);
    }
    return m;
  }, [todos]);

  // Next upcoming deadlines (next 5, future or today, not completed)
  const upcomingTodos = useMemo(() => {
    const today = startOfDay(new Date());
    return todos
      .filter(t => t.deadline && t.status !== 'completed' && startOfDay(new Date(t.deadline)).getTime() >= today.getTime())
      .sort((a, b) => compareAsc(new Date(a.deadline!), new Date(b.deadline!)))
      .slice(0, 5);
  }, [todos]);

  // Format deadline cell
  const formatDeadlineCell = (deadline: string | null, isCompleted: boolean) => {
    if (!deadline) {
      return <span className="text-[12px] text-ab-fg-3">—</span>;
    }
    const target = startOfDay(new Date(deadline));
    const today = startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (!isCompleted && diffDays < 0) {
      return <span className="text-[12px] text-ab-danger font-medium">Forfalt</span>;
    }
    if (diffDays === 0) {
      const time = new Date(deadline).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
      const hasTime = time !== '00:00';
      return <span className="text-[12px] text-ab-accent font-medium">I dag{hasTime ? ` ${time}` : ''}</span>;
    }
    if (diffDays === 1) {
      return <span className="text-[12px] text-ab-fg-2">I morgen</span>;
    }
    const fmt = new Intl.DateTimeFormat('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(deadline));
    return <span className="text-[12px] text-ab-fg-2">{fmt}</span>;
  };

  // Created at: short date
  const formatCreatedAt = (iso: string) => {
    const d = new Date(iso);
    return `Opprettet ${d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  };

  // Build the mini calendar grid for the currently-viewed month
  const calendarData = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const heading = format(viewMonth, 'LLLL yyyy', { locale: nb }).toUpperCase();
    return { monthStart, days, heading };
  }, [viewMonth]);

  // Helper: given a count, return density classes for a calendar cell
  const cellDensity = (count: number, overdue: boolean): string => {
    if (overdue) return 'bg-ab-danger-bg text-ab-danger ring-1 ring-ab-danger/40';
    if (count === 0) return '';
    if (count === 1) return 'bg-ab-accent/10 text-ab-fg';
    if (count <= 3) return 'bg-ab-accent/25 text-ab-fg';
    return 'bg-ab-accent/45 text-ab-fg font-semibold';
  };

  // Toggle status helper (checkbox) — fires toast with Angre that reverses the change
  const handleToggleComplete = async (todo: Todo) => {
    const previousStatus = todo.status;
    const newStatus = previousStatus === 'completed' ? 'pending' : 'completed';
    try {
      setIsUpdating(true);
      const updated = await updateTodo(todo.id, { status: newStatus });
      setTodos(prev => prev.map(t => (t.id === todo.id ? updated : t)));
      const statsData = await getTodoStats();
      setStats(statsData);

      // Toast with Angre — only when marking as complete; uncomplete is silent
      if (newStatus === 'completed') {
        const undo = async () => {
          try {
            const reverted = await updateTodo(todo.id, { status: previousStatus });
            setTodos(prev => prev.map(t => (t.id === todo.id ? reverted : t)));
            const s = await getTodoStats();
            setStats(s);
          } catch (e) {
            console.error('Error undoing toggle:', e);
          }
        };
        toast({
          title: 'Oppgave fullført',
          description: todo.title,
          action: (
            <button
              type="button"
              onClick={undo}
              className="text-[12px] font-medium text-ab-accent hover:text-ab-accent-2 px-2 py-1 rounded-ab-sm hover:bg-ab-hover transition-colors"
            >
              Angre
            </button>
          ) as any,
        });
      }
    } catch (err) {
      console.error('Error toggling todo:', err);
      toast({
        title: 'Kunne ikke oppdatere',
        description: 'Prøv igjen.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Row-action quick delete (confirmed via AlertDialog)
  const handleRowDelete = async (todo: Todo) => {
    try {
      setIsUpdating(true);
      await deleteTodo(todo.id);
      setTodos(prev => prev.filter(t => t.id !== todo.id));
      const s = await getTodoStats();
      setStats(s);
      toast({ title: 'Oppgave slettet' });
    } catch (err) {
      console.error('Error deleting todo:', err);
      toast({
        title: 'Kunne ikke slette',
        description: 'Prøv igjen.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
      setRowDeleteConfirmTodo(null);
    }
  };

  // Duplicate a todo — re-creates with same fields
  const handleDuplicateTodo = async (todo: Todo) => {
    try {
      setIsUpdating(true);
      const { createTodo } = await import('@/services/todoService');
      const dup = await createTodo({
        title: todo.title,
        description: todo.description || undefined,
        priority: todo.priority,
        deadline: todo.deadline || undefined,
      });
      setTodos(prev => [...prev, dup]);
      const s = await getTodoStats();
      setStats(s);
      toast({ title: 'Oppgave duplisert' });
    } catch (err) {
      console.error('Error duplicating todo:', err);
      toast({
        title: 'Kunne ikke duplisere',
        description: 'Prøv igjen.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Tab click handler
  const handleTabChange = (key: TabKey) => {
    setActiveTab(key);
    setCalendarFocusDate(null);
  };

  // Calendar day click
  const handleCalendarDayClick = (day: Date) => {
    // If already focused on this day, clear it
    if (calendarFocusDate && isSameDay(calendarFocusDate, day)) {
      setCalendarFocusDate(null);
    } else {
      setCalendarFocusDate(day);
    }
  };

  // Tabs
  const tabs: Array<{ key: TabKey; label: string; count: number; dot: string }> = [
    { key: 'active',    label: 'Aktive',    count: tabCounts.active,    dot: 'var(--ab-info-fg)' },
    { key: 'today',     label: 'I dag',     count: tabCounts.today,     dot: 'var(--ab-accent-9)' },
    { key: 'overdue',   label: 'Forsinket', count: tabCounts.overdue,   dot: 'var(--ab-danger-fg)' },
    { key: 'completed', label: 'Ferdig',    count: tabCounts.completed, dot: 'var(--ab-success-fg)' },
    { key: 'all',       label: 'Alle',      count: tabCounts.all,       dot: 'var(--ab-text-tertiary)' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-4 w-4 animate-spin text-ab-fg-3" />
        <span className="ml-2 text-[13px] text-ab-fg-2">Laster oppgaver...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-ab-danger mb-4 text-[13px]">{error}</p>
          <Button onClick={loadTodos} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Prøv igjen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col">
        {/* Page header */}
        <PageHeader
          eyebrow={
            (filters.adminAssigned ?? 'all') === 'admin'
              ? 'TILDELT AV ADMIN · TEAM-VISNING'
              : (filters.adminAssigned ?? 'all') === 'personal'
              ? 'PERSONLIG LISTE · IKKE TEAM-VISNING'
              : 'ALLE OPPGAVER · TEAM-VISNING'
          }
          title="Mine oppgaver"
          action={
            <button
              type="button"
              onClick={handleCreateTodo}
              className="ab-btn primary"
            >
              <Plus className="h-3.5 w-3.5" />
              Ny oppgave
            </button>
          }
        />

        {/* Admin info banner */}
        {isAdmin && !bannerDismissed && (
          <div className="bg-ab-accent/[0.05] border-y border-ab-accent/15 px-4 md:px-6 py-2.5 text-[13px] text-ab-fg flex items-center gap-2">
            <Shield className="h-4 w-4 text-ab-accent shrink-0" />
            <span className="flex-1">
              Vil du tildele oppgaver til andre?{' '}
              <Link
                href="/admin/tasks"
                className="text-ab-accent hover:text-ab-accent-2 font-medium inline-flex items-center gap-1"
              >
                Gå til Tildel oppgaver
                <ArrowRight className="h-3 w-3" />
              </Link>
            </span>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem('dismissed:tildel-banner', '1');
                } catch {}
                setBannerDismissed(true);
              }}
              aria-label="Lukk"
              className="h-6 w-6 inline-flex items-center justify-center rounded-ab-sm text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Tab bar — unified with KPI counts (replaces standalone KPI strip) */}
        <div className="flex items-center gap-1 px-4 md:px-6 border-b border-ab-line-1 overflow-x-auto pt-3">
          {tabs.map(tab => {
            const isActive = activeTab === tab.key && !calendarFocusDate;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`group relative h-9 px-3 rounded-t-md inline-flex items-center gap-2 whitespace-nowrap transition-colors duration-120 ${
                  isActive
                    ? 'bg-ab-subtle text-ab-fg font-semibold after:absolute after:left-2 after:right-2 after:-bottom-px after:h-0.5 after:bg-ab-accent'
                    : 'text-ab-fg-2 hover:bg-ab-subtle/60 hover:text-ab-fg'
                }`}
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: tab.dot }}
                />
                <span className="text-[13px]">{tab.label}</span>
                <span className="text-[12px] text-ab-fg-3 tabular mono">
                  ({tab.count})
                </span>
              </button>
            );
          })}
          {calendarFocusDate && (
            <button
              type="button"
              onClick={() => setCalendarFocusDate(null)}
              className="pb-2 pt-3 text-[12px] text-ab-accent hover:text-ab-accent-2 ml-auto whitespace-nowrap"
            >
              {format(calendarFocusDate, 'd. MMM', { locale: nb })} · Tilbakestill
            </button>
          )}
        </div>

        {/* Slim filter row */}
        <div className="px-4 md:px-6 pt-3">
          <TodoFilters
            filters={filters}
            onFiltersChange={setFilters}
            onClearFilters={handleClearFilters}
            hasActiveFilters={!!hasActiveFilters}
          />
        </div>

        {/* Bulk Actions strip (select-all + floating bar) */}
        {tabFilteredTodos.length > 0 && (
          <div className="px-4 md:px-6">
            <TodoBulkActions
              todos={tabFilteredTodos}
              selectedTodos={selectedTodoIds}
              onSelectionChange={setSelectedTodoIds}
              onBulkComplete={handleBulkComplete}
              onBulkDelete={handleBulkDelete}
              isLoading={loading || isUpdating}
            />
          </div>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 px-4 md:px-6 py-4">
          {/* LEFT: Task table */}
          <div className="ab-card rounded-ab-lg overflow-hidden">
            {tabFilteredTodos.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16">
                <Inbox className="h-6 w-6 text-ab-fg-4 mb-2 opacity-60" />
                <div className="eyebrow text-ab-fg-3 mb-1">INGEN OPPGAVER</div>
                <p className="text-[13px] text-ab-fg-3">
                  Ingen oppgaver i denne visningen
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  {/* Header row */}
                  <div
                    className="grid items-center gap-3 px-4 py-2 sticky top-0 bg-ab-subtle z-10 border-b border-ab-line"
                    style={{ gridTemplateColumns: '28px 1fr 110px 140px 140px 60px' }}
                  >
                    <span />
                    <span className="eyebrow text-ab-fg-3">OPPGAVE</span>
                    <span className="eyebrow text-ab-fg-3">PRIORITET</span>
                    <span className="eyebrow text-ab-fg-3">FRIST</span>
                    <span className="eyebrow text-ab-fg-3">OMRÅDE</span>
                    <span className="eyebrow text-ab-fg-3 text-right">TILDELT AV</span>
                  </div>

                  {/* Rows */}
                  {tabFilteredTodos.map(todo => {
                    const isCompleted = todo.status === 'completed';
                    const isSelected = selectedTodoIds.includes(todo.id);
                    const priorityKey = todo.priority;
                    const priorityTone = PRIORITY_TONE[priorityKey];
                    const priorityLabel = PRIORITY_LABEL_NB[priorityKey];
                    const area = todo.related_address || todo.related_campaign || null;
                    const tildeltAvName =
                      todo.assigned_by?.username || todo.user_name || null;
                    const initials = getInitials(tildeltAvName);

                    return (
                      <div
                        key={todo.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleTodoClick(todo)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleTodoClick(todo);
                          }
                        }}
                        className={`group/row relative grid items-center gap-3 px-4 py-2.5 border-b border-ab-line-1 cursor-pointer hover:bg-ab-subtle/60 transition-colors duration-120 ${
                          isCompleted ? 'opacity-60' : ''
                        } ${isSelected ? 'bg-ab-hover/30' : ''}`}
                        style={{
                          gridTemplateColumns: '28px 1fr 110px 140px 140px 60px',
                          minHeight: '54px',
                        }}
                      >
                        {/* Hover action strip — absolutely positioned, fades in on row hover */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity duration-150 z-10 bg-ab-elevated/95 backdrop-blur-sm rounded-md px-1 py-1 border border-ab-line-1 shadow-sm"
                        >
                          <button
                            type="button"
                            title={isCompleted ? 'Marker som aktiv' : 'Marker som fullført'}
                            onClick={() => handleToggleComplete(todo)}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ab-fg-3 hover:text-ab-success hover:bg-ab-hover transition-colors"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          {!todo.is_admin_assigned && (
                            <button
                              type="button"
                              title="Rediger"
                              onClick={() => handleTodoClick(todo)}
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                title="Flere"
                                className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover transition-colors"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[160px]">
                              <DropdownMenuItem
                                onSelect={() => handleDuplicateTodo(todo)}
                                className="cursor-pointer"
                              >
                                Dupliser
                              </DropdownMenuItem>
                              {!todo.is_admin_assigned && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => setRowDeleteConfirmTodo(todo)}
                                    className="cursor-pointer text-ab-danger focus:text-ab-danger"
                                  >
                                    Slett
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Checkbox */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center"
                        >
                          <Checkbox
                            checked={isCompleted}
                            onCheckedChange={() => handleToggleComplete(todo)}
                          />
                        </div>

                        {/* OPPGAVE column */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[13px] font-medium text-ab-fg truncate ${
                                isCompleted ? 'line-through text-ab-fg-3' : ''
                              }`}
                            >
                              {todo.title}
                            </span>
                            {todo.is_admin_assigned && (
                              <span
                                className="ab-pill info shrink-0"
                                style={{ padding: '2px 6px', fontSize: '10px' }}
                              >
                                <Shield className="h-3 w-3" />
                                Admin
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-ab-fg-3 mono mt-0.5">
                            {formatCreatedAt(todo.created_at)}
                          </div>
                        </div>

                        {/* PRIORITET */}
                        <div>
                          <StatusPill tone={priorityTone} dot={false}>
                            {priorityLabel}
                          </StatusPill>
                        </div>

                        {/* FRIST */}
                        <div>{formatDeadlineCell(todo.deadline, isCompleted)}</div>

                        {/* OMRÅDE */}
                        <div className="min-w-0">
                          {area ? (
                            <span className="text-[13px] text-ab-fg-2 truncate block">
                              {area}
                            </span>
                          ) : (
                            <span className="text-[13px] text-ab-fg-3">—</span>
                          )}
                        </div>

                        {/* TILDELT AV */}
                        <div className="flex justify-end">
                          {tildeltAvName ? (
                            <span
                              title={tildeltAvName}
                              className="h-7 w-7 rounded-full bg-ab-active text-ab-fg-2 flex items-center justify-center text-[10px] font-semibold mono"
                            >
                              {initials}
                            </span>
                          ) : (
                            <span className="text-[13px] text-ab-fg-3">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Smart deadline calendar */}
          <aside className="ab-card rounded-ab-lg overflow-hidden h-fit">
            {/* Header with month navigation */}
            <div className="px-3 py-2.5 border-b border-ab-line-1 flex items-center justify-between">
              <div className="eyebrow">FRISTER · {calendarData.heading}</div>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setViewMonth(m => subMonths(m, 1))}
                  className="h-6 w-6 inline-flex items-center justify-center rounded-ab-sm text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover transition-colors"
                  aria-label="Forrige måned"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMonth(new Date())}
                  className="text-[10px] text-ab-fg-3 hover:text-ab-fg uppercase tracking-wider px-1.5 transition-colors"
                  title="Gå til denne måneden"
                >
                  I dag
                </button>
                <button
                  type="button"
                  onClick={() => setViewMonth(m => addMonths(m, 1))}
                  className="h-6 w-6 inline-flex items-center justify-center rounded-ab-sm text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover transition-colors"
                  aria-label="Neste måned"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="p-3">
              {/* Weekday header */}
              <div className="grid grid-cols-7 mb-1.5">
                {['M', 'T', 'O', 'T', 'F', 'L', 'S'].map((d, i) => (
                  <div
                    key={i}
                    className="text-[10px] text-ab-fg-3 uppercase tracking-wider mono text-center"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Date cells with density tinting + count badge */}
              <div className="grid grid-cols-7 gap-y-1">
                {calendarData.days.map(day => {
                  const inMonth = isSameMonth(day, viewMonth);
                  const isCurrentDay = isToday(day);
                  const entry = deadlineByDay.get(day.toDateString());
                  const count = entry?.count ?? 0;
                  const overdue = entry?.overdue ?? false;
                  const isFocused = calendarFocusDate && isSameDay(calendarFocusDate, day);
                  const density = cellDensity(count, overdue);
                  const tooltip = entry
                    ? `${count} ${count === 1 ? 'frist' : 'frister'}${overdue ? ' · forfalt' : ''}\n${entry.titles.join('\n')}${count > entry.titles.length ? `\n+${count - entry.titles.length} til` : ''}`
                    : undefined;

                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => handleCalendarDayClick(day)}
                      title={tooltip}
                      className={[
                        'relative h-8 w-8 mx-auto flex items-center justify-center rounded-ab-md text-[11px] mono transition-colors',
                        inMonth ? 'text-ab-fg-2' : 'text-ab-fg-4 opacity-40',
                        density,
                        isCurrentDay && !isFocused ? 'ring-1 ring-ab-accent text-ab-fg' : '',
                        isFocused ? '!bg-ab-accent !text-[var(--ab-text-on-accent)] ring-1 ring-ab-accent font-semibold' : '',
                        'hover:bg-ab-hover',
                      ].filter(Boolean).join(' ')}
                    >
                      <span>{format(day, 'd')}</span>
                      {count > 0 && !isFocused && (
                        <span className="absolute -bottom-0.5 right-0.5 text-[8px] leading-none mono opacity-80">
                          {count > 9 ? '9+' : count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-3 pt-3 border-t border-ab-line-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-ab-fg-3 uppercase tracking-wider mono">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-ab-sm bg-ab-accent/10 inline-block" />
                  1
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-ab-sm bg-ab-accent/25 inline-block" />
                  2-3
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-ab-sm bg-ab-accent/45 inline-block" />
                  4+
                </span>
                <span className="flex items-center gap-1.5 ml-auto">
                  <span className="h-2.5 w-2.5 rounded-ab-sm bg-ab-danger-bg ring-1 ring-ab-danger/40 inline-block" />
                  Forfalt
                </span>
              </div>
            </div>

            {/* Neste frister (next up to 5 deadlines) */}
            {upcomingTodos.length > 0 && (
              <div className="border-t border-ab-line-1 px-3 py-3">
                <div className="eyebrow mb-2 flex items-center gap-1.5">
                  <Flame className="h-3 w-3 text-ab-fg-3" />
                  NESTE FRISTER
                </div>
                <ul className="space-y-1.5">
                  {upcomingTodos.map(t => {
                    const d = new Date(t.deadline!);
                    const today0 = startOfDay(new Date());
                    const t0 = startOfDay(d);
                    const diff = Math.round((t0.getTime() - today0.getTime()) / 86400000);
                    const dateLabel = diff === 0 ? 'I dag'
                      : diff === 1 ? 'I morgen'
                      : new Intl.DateTimeFormat('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => handleTodoClick(t)}
                          className="w-full text-left flex items-center gap-2 px-1.5 py-1 rounded-ab-sm hover:bg-ab-hover transition-colors group"
                        >
                          <span className="mono text-[10px] text-ab-fg-3 w-[60px] shrink-0 uppercase tracking-wider">{dateLabel}</span>
                          <span className="text-[12px] text-ab-fg-2 group-hover:text-ab-fg truncate flex-1">{t.title}</span>
                          {t.priority === 'high' && (
                            <span className="h-1.5 w-1.5 rounded-full bg-ab-danger shrink-0" title="Høy prioritet" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </aside>
        </div>

        {/* Mobile Floating Action Button */}
        {isMobile && (
          <div className="fixed bottom-6 right-6 z-40">
            <button
              type="button"
              onClick={handleCreateTodo}
              className="bg-ab-fg text-ab-on-accent rounded-full h-14 w-14 shadow-md flex items-center justify-center transition-colors hover:bg-ab-fg/90"
              aria-label="Opprett oppgave"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
        )}

        {/* Drag Overlay (kept for sensor wiring compatibility) */}
        <DragOverlay>
          {activeTodo ? (
            <div className="scale-[1.02] shadow-lg cursor-grabbing">
              <TodoCard
                todo={activeTodo}
                onUpdate={() => {}}
                isMobile={isMobile}
              />
            </div>
          ) : null}
        </DragOverlay>

        {/* Loading Overlay */}
        {isUpdating && (
          <div className="fixed inset-0 bg-ab-overlay/60 backdrop-blur-[2px] flex items-center justify-center z-50">
            <div className="bg-ab-elevated border border-ab-line rounded-ab-lg p-3 flex items-center gap-2 shadow-lg">
              <RefreshCw className="h-4 w-4 animate-spin text-ab-fg-3" />
              <span className="text-[13px] text-ab-fg">Oppdaterer...</span>
            </div>
          </div>
        )}
      </div>

      {/* TODO Detail Modal */}
      <TodoModal
        todo={selectedTodo}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onUpdate={handleTodoUpdate}
        onDelete={handleTodoDelete}
      />

      {/* Create TODO Form */}
      <CreateTodoForm
        isOpen={isCreateFormOpen}
        onClose={() => setIsCreateFormOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Row-action delete confirm */}
      <AlertDialog
        open={!!rowDeleteConfirmTodo}
        onOpenChange={(o) => !o && setRowDeleteConfirmTodo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Vil du slette &quot;{rowDeleteConfirmTodo?.title}&quot;? Denne handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rowDeleteConfirmTodo && handleRowDelete(rowDeleteConfirmTodo)}
              className="bg-ab-danger text-ab-on-accent hover:bg-ab-danger/90"
            >
              Slett
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DndContext>
  );
}

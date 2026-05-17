"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { listAdminTasks, deleteAdminTask, AdminTaskFilters } from '@/services/adminTaskService';
import { AdminAssignedTask } from '@/types/todo';
import { CreateTaskForm } from '@/components/admin-tasks/CreateTaskForm';
import { AdminTaskList } from '@/components/admin-tasks/AdminTaskList';
import { AdminTaskDetail } from '@/components/admin-tasks/AdminTaskDetail';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, RefreshCw, AlertCircle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export default function AdminTasksPage() {
  const isMobile = useIsMobile();

  const [tasks, setTasks] = useState<AdminAssignedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filters, setFilters] = useState<AdminTaskFilters>({
    ordering: '-created_at',
  });

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listAdminTasks(filters);
      console.log('[AdminTasksPage] Response from listAdminTasks:', response);
      // Ensure we always set an array, even if response.results is undefined
      const tasksArray = Array.isArray(response?.results) ? response.results : [];
      console.log('[AdminTasksPage] Setting tasks:', tasksArray);
      setTasks(tasksArray);
    } catch (err: any) {
      // Handle 403 - not authorized
      if (err?.message?.includes('403') || err?.message?.includes('Forbidden')) {
        setError('Du har ikke tilgang til admin-oppgaver. Kun superbrukere kan bruke denne funksjonen.');
      } else {
        setError(err instanceof Error ? err.message : 'Kunne ikke laste oppgaver');
      }
      // Set empty array on error to prevent undefined issues
      setTasks([]);
      console.error('Error loading tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Load tasks on mount and when filters change
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleTaskCreated = (task: AdminAssignedTask) => {
    loadTasks();
    setShowCreateForm(false);
  };

  const handleTaskClick = (task: AdminAssignedTask) => {
    setSelectedTaskId(task.id);
  };

  const handleTaskUpdate = () => {
    loadTasks();
  };

  const handleTaskDelete = async (taskId: string) => {
    try {
      await deleteAdminTask(taskId);
      if (selectedTaskId === taskId) {
        setSelectedTaskId(null);
      }
      loadTasks();
    } catch (err) {
      console.error('Error deleting task:', err);
      throw err;
    }
  };

  const handleCloseDetail = () => {
    setSelectedTaskId(null);
  };

  const handleOpenCreateForm = () => {
    setShowCreateForm(true);
  };

  const handleCloseCreateForm = () => {
    setShowCreateForm(false);
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Tildel oppgaver</h2>
          <p className="text-muted-foreground mt-1">
            Opprett og administrer oppgaver tildelt ledere og administratorer
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={loadTasks}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleOpenCreateForm}>
            <Plus className="h-4 w-4 mr-2" />
            {isMobile ? 'Ny' : 'Opprett oppgave'}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task List */}
      <div className="space-y-4">
        <AdminTaskList
          tasks={tasks}
          loading={loading}
          onTaskClick={handleTaskClick}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </div>

      {/* Create Task Form - Only render when needed */}
      {showCreateForm && (
        <CreateTaskForm
          isOpen={showCreateForm}
          onClose={handleCloseCreateForm}
          onSuccess={handleTaskCreated}
        />
      )}

      {/* Task Detail - Only render when needed */}
      {selectedTaskId && (
        <AdminTaskDetail
          taskId={selectedTaskId}
          onClose={handleCloseDetail}
          onTaskUpdate={handleTaskUpdate}
          onTaskDelete={handleTaskDelete}
        />
      )}
    </div>
  );
}

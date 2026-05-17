"use client";

import React, { useState, useEffect } from 'react';
import { AdminAssignedTask } from '@/types/todo';
import { getAdminTask } from '@/services/adminTaskService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { 
  ArrowLeft,
  Calendar,
  Users,
  CheckCircle2,
  UserPlus,
  UserMinus,
  Edit,
  Trash2,
  RefreshCw,
  Clock,
  AlertCircle
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { AddAssigneesModal } from './AddAssigneesModal';
import { RemoveAssigneesModal } from './RemoveAssigneesModal';
import { UpdateTaskModal } from './UpdateTaskModal';

interface AdminTaskDetailProps {
  taskId: string | null;
  onClose: () => void;
  onTaskUpdate: () => void;
  onTaskDelete: (taskId: string) => void;
}

export function AdminTaskDetail({
  taskId,
  onClose,
  onTaskUpdate,
  onTaskDelete,
}: AdminTaskDetailProps) {
  const [task, setTask] = useState<AdminAssignedTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isMobile = useIsMobile();

  useEffect(() => {
    if (taskId) {
      loadTask();
    }
  }, [taskId]);

  const loadTask = async () => {
    if (!taskId) return;
    
    try {
      setLoading(true);
      setError(null);
      const taskData = await getAdminTask(taskId);
      setTask(taskData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke laste oppgave');
      console.error('Error loading task:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!taskId) return;
    
    try {
      setIsDeleting(true);
      await onTaskDelete(taskId);
      setShowDeleteDialog(false);
      onClose();
    } catch (err) {
      console.error('Error deleting task:', err);
    } finally {
      setIsDeleting(false);
    }
  };

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

  if (!taskId) return null;

  return (
    <>
      <Dialog open={!!taskId} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className={isMobile ? 'max-w-[95vw] max-h-[90vh]' : 'max-w-4xl max-h-[90vh]'}>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="mr-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                Oppgavedetaljer
              </DialogTitle>
              <Button
                variant="outline"
                size="icon"
                onClick={loadTask}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </DialogHeader>

          {loading && !task ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : task ? (
            <div className="space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Task Info */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{task.title}</CardTitle>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={getPriorityBadgeVariant(task.priority)}>
                          {getPriorityLabel(task.priority)}
                        </Badge>
                        {task.deadline && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {formatDate(task.deadline)}
                          </div>
                        )}
                        {task.is_fully_completed && (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Fullstendig fullført
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {task.description && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Beskrivelse</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {task.description}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Tildelt</p>
                      <p className="text-lg font-semibold">{task.assigned_count}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Fullført</p>
                      <p className="text-lg font-semibold">{task.completed_count}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Ledere</p>
                      <p className="text-lg font-semibold">{task.assigned_managers_count}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Administratorer</p>
                      <p className="text-lg font-semibold">{task.assigned_admins_count}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Fullføringsfremgang</span>
                      <span className="font-medium">{task.completion_percentage.toFixed(0)}%</span>
                    </div>
                    <Progress value={task.completion_percentage} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddModal(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Legg til mottakere
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRemoveModal(true)}
                      disabled={task.assigned_count === 0}
                    >
                      <UserMinus className="h-4 w-4 mr-2" />
                      Fjern mottakere
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowUpdateModal(true)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Oppdater oppgave
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Slett oppgave
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Assignees List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Mottakere ({task.assigned_users.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {task.assigned_users.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Ingen mottakere ennå
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {task.assigned_users.map((assignedUser) => (
                        <div
                          key={assignedUser.user_id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{assignedUser.user_name}</p>
                              <Badge variant="outline" className="text-xs">
                                {assignedUser.user_type}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {assignedUser.status === 'completed' ? (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Fullført
                              </Badge>
                            ) : assignedUser.status === 'in_progress' ? (
                              <Badge variant="secondary">
                                <Clock className="h-3 w-3 mr-1" />
                                Pågår
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Ventende
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Modals */}
      {task && (
        <>
          <AddAssigneesModal
            taskId={task.id}
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            onSuccess={() => {
              loadTask();
              onTaskUpdate();
            }}
          />
          <RemoveAssigneesModal
            taskId={task.id}
            assignedUsers={task.assigned_users}
            isOpen={showRemoveModal}
            onClose={() => setShowRemoveModal(false)}
            onSuccess={() => {
              loadTask();
              onTaskUpdate();
            }}
          />
          <UpdateTaskModal
            task={task}
            isOpen={showUpdateModal}
            onClose={() => setShowUpdateModal(false)}
            onSuccess={() => {
              loadTask();
              onTaskUpdate();
            }}
          />
        </>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett oppgave</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil slette denne oppgaven? Dette vil også slette alle tilknyttede oppgaver
              for alle mottakere. Denne handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sletter...
                </>
              ) : (
                'Slett'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

"use client";

import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Todo } from '@/types/todo';
import { updateTodo, deleteTodo } from '@/services/todoService';
import { toast } from '@/components/ui/use-toast';
import {
  Trash2,
  Save,
  X,
  Pencil,
  AlertTriangle,
  Shield,
  Clock,
  CalendarDays,
} from 'lucide-react';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

interface TodoModalProps {
  todo: Todo | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (todo: Todo) => void;
  onDelete: (todoId: string) => void;
}

export function TodoModal({ todo, isOpen, onClose, onUpdate, onDelete }: TodoModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    deadline: '',
    status: 'pending' as 'pending' | 'in_progress' | 'completed',
  });

  useEffect(() => {
    if (todo) {
      setFormData({
        title: todo.title,
        description: todo.description || '',
        priority: todo.priority,
        deadline: todo.deadline ? todo.deadline.split('T')[0] : '',
        status: todo.status,
      });
      setIsEditing(false);
      setError(null);
    }
  }, [todo]);

  const handleSave = async () => {
    if (!todo) return;

    try {
      setIsSaving(true);
      setError(null);

      const updateData: any = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        status: formData.status,
      };

      if (formData.deadline) {
        updateData.deadline = new Date(formData.deadline).toISOString();
      }

      const updatedTodo = await updateTodo(todo.id, updateData);
      onUpdate(updatedTodo);
      setIsEditing(false);
      toast({ title: 'Oppgave oppdatert' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Kunne ikke lagre. Prøv igjen.';
      setError(msg);
      toast({ title: 'Kunne ikke lagre', description: msg, variant: 'destructive' });
      console.error('Error updating TODO:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!todo) return;

    try {
      setIsDeleting(true);
      setError(null);

      await deleteTodo(todo.id);
      onDelete(todo.id);
      toast({ title: 'Oppgave slettet' });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete TODO';
      setError(msg);
      toast({ title: 'Kunne ikke slette', description: msg, variant: 'destructive' });
      console.error('Error deleting TODO:', err);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCancel = () => {
    if (todo) {
      setFormData({
        title: todo.title,
        description: todo.description || '',
        priority: todo.priority,
        deadline: todo.deadline ? todo.deadline.split('T')[0] : '',
        status: todo.status,
      });
    }
    setIsEditing(false);
    setError(null);
  };

  const getPriorityTone = (priority: string): 'danger' | 'warn' | 'info' => {
    switch (priority) {
      case 'high':
        return 'danger';
      case 'medium':
        return 'warn';
      case 'low':
        return 'info';
      default:
        return 'info';
    }
  };

  const getStatusTone = (status: string): 'success' | 'info' => {
    return status === 'completed' ? 'success' : 'info';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Ikke satt';
    return new Date(dateString).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateShort = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getRelativeDate = (dateString: string | null): string | null => {
    if (!dateString) return null;
    const target = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDay = new Date(target);
    targetDay.setHours(0, 0, 0, 0);
    const diffMs = targetDay.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'i dag';
    if (diffDays === 1) return 'i morgen';
    if (diffDays === -1) return 'i går';
    if (diffDays > 1) return `om ${diffDays} dager`;
    return `for ${Math.abs(diffDays)} dager siden`;
  };

  if (!todo) return null;

  const priorityTone = getPriorityTone(todo.priority);
  const statusTone = getStatusTone(todo.status);

  const editDeadlineLabel = formData.deadline
    ? format(new Date(formData.deadline), 'd. MMM yyyy', { locale: nb })
    : '';

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[480px] sm:w-[480px] p-0 bg-ab-canvas border-l border-ab-line flex flex-col"
        >
          <SheetTitle className="sr-only">{todo.title}</SheetTitle>

          {/* Sticky header */}
          <div className="sticky top-0 z-10 bg-ab-canvas border-b border-ab-line-1 px-5 py-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
                {isEditing ? 'ARBEIDSFLATE · REDIGER OPPGAVE' : 'OPPGAVE · LES MODUS'}
              </div>
              {isEditing ? (
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Oppgavetittel..."
                  disabled={isSaving || todo.is_admin_assigned}
                  className="mt-2 text-[20px] font-semibold tracking-tight bg-ab-elevated border-ab-line rounded-ab-md"
                />
              ) : (
                <>
                  <h2 className="text-[20px] font-semibold tracking-tight text-ab-fg mt-1 pr-2 break-words">
                    {todo.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className={`ab-pill ${statusTone}`}>
                      <span className="ab-dot" />
                      {todo.status_display}
                    </span>
                    <span className={`ab-pill ${priorityTone}`}>
                      {todo.priority_display}
                    </span>
                    {todo.is_overdue && (
                      <span className="ab-pill danger">
                        <AlertTriangle className="h-3 w-3" />
                        Forsinket
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!isEditing && !todo.is_admin_assigned && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="h-8 px-3 rounded-md border border-ab-line bg-ab-elevated text-[12px] text-ab-fg-2 hover:text-ab-fg hover:bg-ab-hover hover:border-ab-line-2 inline-flex items-center gap-1.5 transition-colors"
                  title="Rediger"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Rediger
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="h-8 w-8 rounded-full inline-flex items-center justify-center text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover transition-colors"
                aria-label="Lukk"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {error && (
              <div className="mx-5 mt-4 bg-ab-danger-bg/40 border border-ab-danger/20 text-ab-danger text-[12px] px-3 py-2 rounded-ab-md flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Beskrivelse */}
            <section className="px-5 py-5 border-b border-ab-line-1">
              <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold mb-2">
                BESKRIVELSE
              </div>
              {isEditing ? (
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Beskriv oppgaven..."
                  rows={4}
                  disabled={isSaving || todo.is_admin_assigned}
                  className="bg-ab-elevated border-ab-line rounded-ab-md text-[13px] min-h-[110px]"
                />
              ) : todo.description ? (
                <p className="text-[14px] text-ab-fg leading-relaxed whitespace-pre-wrap">
                  {todo.description}
                </p>
              ) : (
                <p className="text-[13px] text-ab-fg-3 italic">Ingen beskrivelse</p>
              )}
            </section>

            {/* Status & prioritet (edit mode adds dropdowns; view shows in header pills) */}
            {isEditing && (
              <section className="px-5 py-5 border-b border-ab-line-1">
                <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold mb-2">
                  STATUS &amp; PRIORITET
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'pending' | 'in_progress' | 'completed') =>
                      setFormData((prev) => ({ ...prev, status: value }))
                    }
                    disabled={isSaving || todo.is_admin_assigned}
                  >
                    <SelectTrigger className="h-10 bg-ab-elevated border-ab-line rounded-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Venter...</SelectItem>
                      <SelectItem value="in_progress">Pågår</SelectItem>
                      <SelectItem value="completed">Fullført</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={formData.priority}
                    onValueChange={(value: 'low' | 'medium' | 'high') =>
                      setFormData((prev) => ({ ...prev, priority: value }))
                    }
                    disabled={isSaving || todo.is_admin_assigned}
                  >
                    <SelectTrigger className="h-10 bg-ab-elevated border-ab-line rounded-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Lav</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">Høy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </section>
            )}

            {/* Frist */}
            <section className="px-5 py-5 border-b border-ab-line-1">
              <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold mb-2">
                FRIST
              </div>
              {isEditing ? (
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={isSaving || todo.is_admin_assigned}
                      className={`w-full h-10 rounded-md border bg-ab-elevated text-[13px] flex items-center gap-2 px-3 transition-colors ${
                        datePickerOpen
                          ? 'border-ab-accent/30 ring-2 ring-ab-accent/15'
                          : 'border-ab-line hover:border-ab-line-2'
                      } disabled:opacity-60`}
                    >
                      <CalendarDays className="h-3.5 w-3.5 text-ab-fg-3" />
                      {editDeadlineLabel ? (
                        <span className="text-ab-fg">{editDeadlineLabel}</span>
                      ) : (
                        <span className="text-ab-fg-3">Velg dato</span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="p-2 bg-ab-canvas border-ab-line"
                    style={{ width: 'auto' }}
                  >
                    <Calendar
                      mode="single"
                      locale={nb}
                      weekStartsOn={1}
                      selected={formData.deadline ? new Date(formData.deadline) : undefined}
                      onSelect={(d) => {
                        if (d) {
                          setFormData((prev) => ({
                            ...prev,
                            deadline: d.toISOString().slice(0, 10),
                          }));
                          setDatePickerOpen(false);
                        }
                      }}
                      initialFocus
                    />
                    {formData.deadline && (
                      <div className="pt-2 border-t border-ab-line-1 mt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, deadline: '' }));
                            setDatePickerOpen(false);
                          }}
                          className="w-full text-[12px] text-ab-fg-3 hover:text-ab-fg py-1.5 hover:bg-ab-hover rounded-ab-sm transition-colors"
                        >
                          Fjern frist
                        </button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              ) : todo.deadline ? (
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-ab-fg-3" />
                  <span className={`text-[14px] ${todo.is_overdue ? 'text-ab-danger font-medium' : 'text-ab-fg'}`}>
                    {formatDateShort(todo.deadline)}
                  </span>
                  {getRelativeDate(todo.deadline) && (
                    <span className="text-[12px] text-ab-fg-3">
                      · {getRelativeDate(todo.deadline)}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-[13px] text-ab-fg-3 italic">Ikke satt</p>
              )}
            </section>

            {/* Aktivitet (Detaljer) */}
            <section className="px-5 py-5 border-b border-ab-line-1">
              <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold mb-3">
                AKTIVITET
              </div>
              <div className="bg-ab-subtle/40 rounded-md p-3 grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ab-fg-4 font-semibold">
                    LAGD AV
                  </div>
                  <div className="text-[13px] text-ab-fg mt-0.5 truncate">{todo.user_name}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ab-fg-4 font-semibold">
                    OPPRETTET
                  </div>
                  <div className="mono text-[12px] text-ab-fg-2 mt-0.5">
                    {formatDate(todo.created_at)}
                  </div>
                </div>
                {todo.updated_at !== todo.created_at && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-ab-fg-4 font-semibold">
                      SIST OPPDATERT
                    </div>
                    <div className="mono text-[12px] text-ab-fg-2 mt-0.5">
                      {formatDate(todo.updated_at)}
                    </div>
                  </div>
                )}
                {todo.completed_at && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-ab-fg-4 font-semibold">
                      FULLFØRT
                    </div>
                    <div className="mono text-[12px] text-ab-fg-2 mt-0.5">
                      {formatDate(todo.completed_at)}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Admin-tildelt info */}
            {todo.is_admin_assigned && (
              <section className="px-5 py-5 border-b border-ab-line-1">
                <div className="bg-ab-info-bg/30 border border-ab-info/20 rounded-md p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-ab-info" />
                    <span className="text-[10px] uppercase tracking-wider text-ab-info font-semibold">
                      ADMIN-TILDELT OPPGAVE
                    </span>
                  </div>
                  {todo.assigned_by && (
                    <p className="text-[12px] text-ab-fg-2">
                      Tildelt av:{' '}
                      <span className="font-medium text-ab-fg">{todo.assigned_by.username}</span>
                    </p>
                  )}
                  <p className="text-[11px] text-ab-fg-3 leading-relaxed">
                    Denne oppgaven ble tildelt deg av en administrator. Du kan fullføre den, men
                    redigering og sletting er begrenset.
                  </p>
                </div>
              </section>
            )}
          </div>

          {/* Sticky footer */}
          <div className="border-t border-ab-line-1 bg-ab-canvas px-4 py-3 flex items-center justify-end gap-2">
            {isEditing ? (
              <>
                <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>
                  <X className="h-4 w-4 mr-1.5" />
                  Avbryt
                </Button>
                <Button onClick={handleSave} disabled={isSaving || !formData.title.trim()}>
                  {isSaving ? (
                    <>
                      <Clock className="h-4 w-4 mr-1.5 animate-spin" />
                      Lagrer...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1.5" />
                      Lagre endringer
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                {todo.is_admin_assigned ? (
                  <span className="text-[11px] text-ab-fg-3 mr-auto flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Sletting begrenset
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isDeleting}
                    className="text-ab-danger hover:text-ab-danger mr-auto"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Slett oppgave
                  </Button>
                )}
                <Button variant="ghost" onClick={onClose}>
                  Lukk
                </Button>
                {!todo.is_admin_assigned && (
                  <Button onClick={() => setIsEditing(true)}>
                    <Pencil className="h-4 w-4 mr-1.5" />
                    Rediger
                  </Button>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Vil du slette &quot;{todo.title}&quot;? Denne handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-ab-danger text-ab-on-accent hover:bg-ab-danger/90"
            >
              {isDeleting ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Sletter...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Slett
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

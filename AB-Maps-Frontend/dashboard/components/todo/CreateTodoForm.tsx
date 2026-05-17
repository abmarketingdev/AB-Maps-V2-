"use client";

import React, { useState, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { createTodo, assignTask } from '@/services/todoService';
import { Todo } from '@/types/todo';
import {
  Save,
  X,
  AlertTriangle,
  Clock,
  UserPlus,
  CheckCircle2,
  CalendarDays,
  Plus,
  Phone,
  Mail,
  Users,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';
import { UserAssignmentSelect } from './UserAssignmentSelect';

interface CreateTodoFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (todo: Todo | null) => void;
}

interface FormData {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  deadline: string; // ISO date YYYY-MM-DD
  assignedUserIds: string[];
}

interface FormErrors {
  title?: string;
  deadline?: string;
  general?: string;
}

const INITIAL_FORM: FormData = {
  title: '',
  description: '',
  priority: 'medium',
  deadline: '',
  assignedUserIds: [],
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextMondayISO() {
  const d = new Date();
  const dow = d.getDay(); // Sun=0 .. Sat=6
  const delta = (8 - (dow === 0 ? 7 : dow)) % 7 || 7;
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function CreateTodoForm({ isOpen, onClose, onSuccess }: CreateTodoFormProps) {
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canAssign, setCanAssign] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [titleFocused, setTitleFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);

  const isAssignment = formData.assignedUserIds.length > 0;

  const handlePermissionResolved = useCallback((allowed: boolean) => {
    setCanAssign(allowed);
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Tittel er påkrevd';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'Tittel må være minst 3 tegn';
    } else if (formData.title.trim().length > 200) {
      newErrors.title = 'Tittel kan ikke være mer enn 200 tegn';
    }

    if (formData.deadline) {
      const deadlineDate = new Date(formData.deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (deadlineDate < today) {
        newErrors.deadline = 'Frist kan ikke være i fortiden';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setFormData(INITIAL_FORM);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      setErrors({});

      if (isAssignment) {
        const result = await assignTask({
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          priority: formData.priority,
          deadline: formData.deadline
            ? new Date(formData.deadline).toISOString()
            : undefined,
          user_ids: formData.assignedUserIds,
        });

        toast({ title: 'Oppgave tildelt', description: result.message });
        resetForm();
        onSuccess(null);
        onClose();
      } else {
        const newTodo = await createTodo({
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          priority: formData.priority,
          deadline: formData.deadline
            ? new Date(formData.deadline).toISOString()
            : undefined,
        });

        toast({ title: 'Oppgave opprettet' });
        resetForm();
        onSuccess(newTodo);
        onClose();
      }
    } catch (error) {
      console.error('Error creating task:', error);
      const msg =
        error instanceof Error ? error.message : 'Kunne ikke lagre. Prøv igjen.';
      setErrors({ general: msg });
      toast({ title: 'Kunne ikke lagre', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleInputChange = (
    field: keyof FormData,
    value: string | string[],
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const descriptionLength = formData.description.length;
  const maxDescriptionLength = 2000;
  const titleLength = formData.title.length;

  const priorityOptions: Array<{
    value: 'low' | 'medium' | 'high';
    label: string;
    dot: string;
    activeBg: string;
    activeText: string;
    activeBorder: string;
    activeRing: string;
  }> = [
    {
      value: 'low',
      label: 'Lav',
      dot: 'var(--ab-success-fg)',
      activeBg: 'bg-ab-success-bg',
      activeText: 'text-ab-success',
      activeBorder: 'border-ab-success/30',
      activeRing: 'ring-ab-success/20',
    },
    {
      value: 'medium',
      label: 'Medium',
      dot: 'var(--ab-warning-fg)',
      activeBg: 'bg-ab-warning-bg',
      activeText: 'text-ab-warning',
      activeBorder: 'border-ab-warning/30',
      activeRing: 'ring-ab-warning/20',
    },
    {
      value: 'high',
      label: 'Høy',
      dot: 'var(--ab-danger-fg)',
      activeBg: 'bg-ab-danger-bg',
      activeText: 'text-ab-danger',
      activeBorder: 'border-ab-danger/30',
      activeRing: 'ring-ab-danger/20',
    },
  ];

  const templates: Array<{
    label: string;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      label: 'Følg opp kunde',
      title: 'Følg opp kunde',
      description: 'Follow up with customer',
      icon: Phone,
    },
    {
      label: 'Send e-post',
      title: 'Send e-post',
      description: 'Send information to customer',
      icon: Mail,
    },
    {
      label: 'Møte',
      title: 'Møte',
      description: 'Coordinate meeting with team',
      icon: Users,
    },
    {
      label: 'Rapport',
      title: 'Rapport',
      description: 'Complete weekly report',
      icon: FileText,
    },
  ];

  const deadlineLabel = formData.deadline
    ? format(new Date(formData.deadline), 'd. MMM yyyy', { locale: nb })
    : '';

  const datePresets: { label: string; value: string }[] = [
    { label: 'I dag', value: todayISO() },
    { label: 'I morgen', value: addDaysISO(1) },
    { label: 'Om 3 dager', value: addDaysISO(3) },
    { label: 'Neste uke', value: nextMondayISO() },
    { label: 'Ingen frist', value: '' },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[560px] sm:w-[560px] p-0 bg-ab-canvas border-l border-ab-line flex flex-col"
      >
        <SheetTitle className="sr-only">Ny oppgave</SheetTitle>

        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-ab-canvas border-b border-ab-line-1 px-5 py-4 flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
              ARBEIDSFLATE · NY OPPGAVE
            </div>
            <h2 className="text-[20px] font-semibold tracking-tight text-ab-fg mt-1">
              Ny oppgave
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Lukk"
            className="h-8 w-8 -mr-1 rounded-full inline-flex items-center justify-center text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {/* Error banner */}
            {errors.general && (
              <div className="bg-ab-danger-bg/40 border border-ab-danger/20 text-ab-danger text-[12px] px-3 py-2 rounded-ab-md flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>{errors.general}</span>
              </div>
            )}

            {/* Tittel + Beskrivelse */}
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="text-[11px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold block mb-1.5">
                  TITTEL<span className="text-ab-danger ml-0.5">*</span>
                </label>
                <div className="relative">
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={e => handleInputChange('title', e.target.value)}
                    onFocus={() => setTitleFocused(true)}
                    onBlur={() => setTitleFocused(false)}
                    placeholder="Skriv inn oppgavetittel…"
                    className={`ab-input h-11 text-[15px] bg-ab-elevated border-ab-line rounded-ab-md ${
                      errors.title ? 'border-ab-danger' : ''
                    }`}
                    disabled={isSubmitting}
                    maxLength={200}
                    autoFocus
                  />
                  {(titleFocused || titleLength > 0) && (
                    <span className="absolute right-3 bottom-1 text-[10px] mono text-ab-fg-3 pointer-events-none">
                      {titleLength} / 200
                    </span>
                  )}
                </div>
                {errors.title && (
                  <p className="mt-1 text-[11px] text-ab-danger">{errors.title}</p>
                )}
              </div>

              <div>
                <label htmlFor="description" className="text-[11px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold block mb-1.5">
                  BESKRIVELSE
                </label>
                <div className="relative">
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={e => handleInputChange('description', e.target.value)}
                    onFocus={() => setDescFocused(true)}
                    onBlur={() => setDescFocused(false)}
                    placeholder="Beskriv oppgaven (valgfritt)…"
                    rows={4}
                    disabled={isSubmitting}
                    maxLength={maxDescriptionLength}
                    className="min-h-[110px] max-h-[280px] bg-ab-elevated border-ab-line rounded-ab-md text-[13px] resize-y"
                  />
                  {(descFocused || descriptionLength > 0) && (
                    <span className="absolute right-3 bottom-2 text-[10px] mono text-ab-fg-3 pointer-events-none">
                      {descriptionLength} / {maxDescriptionLength}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Priority — segmented chips with colored dots in all states */}
            <div>
              <label className="text-[11px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold block mb-1.5">
                PRIORITET
              </label>
              <div className="grid grid-cols-3 gap-2">
                {priorityOptions.map(opt => {
                  const active = formData.priority === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleInputChange('priority', opt.value)}
                      disabled={isSubmitting}
                      className={`flex items-center justify-center gap-2 h-10 rounded-md border transition-colors duration-120 ${
                        active
                          ? `${opt.activeBg} ${opt.activeText} ${opt.activeBorder} ring-2 ${opt.activeRing} font-medium`
                          : 'bg-ab-elevated text-ab-fg border-ab-line hover:bg-ab-subtle hover:border-ab-line-2'
                      }`}
                    >
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ background: opt.dot }}
                      />
                      <span className="text-[13px]">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Frist */}
            <div>
              <label className="text-[11px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold block mb-1.5">
                FRIST
              </label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={`w-full h-10 rounded-md border bg-ab-elevated text-[13px] flex items-center gap-2 px-3 transition-colors ${
                      errors.deadline
                        ? 'border-ab-danger'
                        : datePickerOpen
                        ? 'border-ab-accent/30 ring-2 ring-ab-accent/15'
                        : 'border-ab-line hover:border-ab-line-2'
                    }`}
                  >
                    <CalendarDays className="h-3.5 w-3.5 text-ab-fg-3" />
                    {deadlineLabel ? (
                      <span className="text-ab-fg">{deadlineLabel}</span>
                    ) : (
                      <span className="text-ab-fg-3">Velg dato</span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="p-0 bg-ab-canvas border-ab-line"
                  style={{ width: 'auto' }}
                >
                  <div className="flex">
                    {/* Presets */}
                    <div className="w-[160px] border-r border-ab-line-1 py-2">
                      {datePresets.map(p => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => {
                            handleInputChange('deadline', p.value);
                            setDatePickerOpen(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-[12px] text-ab-fg-2 hover:bg-ab-hover hover:text-ab-fg transition-colors"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    {/* Calendar */}
                    <div className="p-2">
                      <Calendar
                        mode="single"
                        locale={nb}
                        weekStartsOn={1}
                        selected={formData.deadline ? new Date(formData.deadline) : undefined}
                        onSelect={(d) => {
                          if (d) {
                            handleInputChange('deadline', d.toISOString().slice(0, 10));
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
                              handleInputChange('deadline', '');
                              setDatePickerOpen(false);
                            }}
                            className="w-full text-[12px] text-ab-fg-3 hover:text-ab-fg py-1.5 hover:bg-ab-hover rounded-ab-sm transition-colors"
                          >
                            Fjern frist
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              {errors.deadline && (
                <p className="mt-1 text-[11px] text-ab-danger">{errors.deadline}</p>
              )}
            </div>

            {/* Tildel til */}
            <div className="space-y-1.5">
              {canAssign && (
                <label className="text-[11px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold flex items-center gap-1.5 mb-1.5">
                  <UserPlus className="h-3 w-3" />
                  TILDEL TIL (VALGFRITT)
                </label>
              )}
              <UserAssignmentSelect
                selectedUserIds={formData.assignedUserIds}
                onSelectionChange={ids => handleInputChange('assignedUserIds', ids)}
                onPermissionResolved={handlePermissionResolved}
                disabled={isSubmitting}
              />
              {canAssign && (
                <p className="text-[12px] text-ab-fg-3 mt-1">
                  Tildel denne oppgaven til andre brukere. La stå tom for å beholde den selv.
                </p>
              )}
            </div>

            {/* Maler */}
            <div>
              <label className="text-[11px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold block mb-1.5">
                MALER
              </label>
              <p className="text-[12px] text-ab-fg-2 mb-2">
                Klikk for å bruke som utgangspunkt
              </p>
              <div className="flex flex-wrap gap-2">
                {templates.map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          title: t.title,
                          description: t.description,
                        }));
                        if (errors.title) {
                          setErrors(prev => ({ ...prev, title: undefined }));
                        }
                      }}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-ab-line bg-ab-elevated text-[13px] text-ab-fg-2 hover:text-ab-fg hover:bg-ab-hover hover:border-ab-line-2 transition-colors"
                    >
                      <Icon className="h-3.5 w-3.5 text-ab-fg-3" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sticky footer */}
          <div className="border-t border-ab-line-1 bg-ab-canvas px-4 py-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4 mr-1.5" />
              Avbryt
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.title.trim()}>
              {isSubmitting ? (
                <>
                  <Clock className="h-4 w-4 mr-1.5 animate-spin" />
                  {isAssignment ? 'Tildeler...' : 'Oppretter...'}
                </>
              ) : (
                <>
                  {isAssignment ? (
                    <Save className="h-4 w-4 mr-1.5" />
                  ) : (
                    <Plus className="h-4 w-4 mr-1.5" />
                  )}
                  {isAssignment ? 'Tildel' : 'Opprett oppgave'}
                </>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

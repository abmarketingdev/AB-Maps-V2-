"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  MoreVertical,
  CheckCircle,
  Trash2,
  Clock,
} from 'lucide-react';
import { Todo } from '@/types/todo';

interface TodoBulkActionsProps {
  todos: Todo[];
  selectedTodos: string[];
  onSelectionChange: (todoIds: string[]) => void;
  onBulkComplete: (todoIds: string[]) => Promise<void>;
  onBulkDelete: (todoIds: string[]) => Promise<void>;
  isLoading: boolean;
}

export function TodoBulkActions({
  todos,
  selectedTodos,
  onSelectionChange,
  onBulkComplete,
  onBulkDelete,
  isLoading
}: TodoBulkActionsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedCount = selectedTodos.length;
  const totalCount = todos.length;
  const allSelected = selectedCount === totalCount && totalCount > 0;
  const someSelected = selectedCount > 0 && selectedCount < totalCount;

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(todos.map(todo => todo.id));
    }
  };

  const handleBulkComplete = async () => {
    if (selectedCount === 0) return;

    setIsProcessing(true);
    try {
      await onBulkComplete(selectedTodos);
      onSelectionChange([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCount === 0) return;

    setIsProcessing(true);
    try {
      await onBulkDelete(selectedTodos);
      onSelectionChange([]);
      setShowDeleteConfirm(false);
    } finally {
      setIsProcessing(false);
    }
  };

  if (totalCount === 0) {
    return null;
  }

  return (
    <>
      {/* Inline minimal select-all strip */}
      <div className="flex items-center gap-3 py-1.5 text-[12px] text-ab-fg-3">
        <Checkbox
          checked={allSelected}
          onCheckedChange={handleSelectAll}
          disabled={isLoading || isProcessing}
          className="data-[state=indeterminate]:bg-primary h-3.5 w-3.5"
          {...(someSelected && { 'data-state': 'indeterminate' } as any)}
        />
        <span>
          <span className="mono text-ab-fg-2">{totalCount}</span>
          {' '}oppgave{totalCount > 1 ? 'r' : ''}
        </span>
      </div>

      {/* Floating action bar */}
      {selectedCount > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-ab-elevated border border-ab-line-2 rounded-ab-lg shadow-lg px-3 py-2 flex items-center gap-3"
          role="toolbar"
          aria-label="Massehandlinger"
        >
          <div className="flex items-baseline gap-1.5">
            <span className="mono text-[13px] font-semibold text-ab-fg">{selectedCount}</span>
            <span className="eyebrow">valgt</span>
          </div>

          <div className="h-4 w-px bg-ab-line-1" />

          <Button
            size="sm"
            onClick={handleBulkComplete}
            disabled={isLoading || isProcessing}
            className="h-8"
          >
            <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Marker ferdig</span>
            <span className="sm:hidden">Ferdig</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                disabled={isLoading || isProcessing}
                className="h-8 w-8 p-0"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 text-ab-danger focus:text-ab-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Slett valgte
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={() => onSelectionChange([])}
            disabled={isLoading || isProcessing}
            className="text-[11px] text-ab-fg-3 hover:text-ab-fg transition-colors px-1"
          >
            Avbryt
          </button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Slett {selectedCount} oppgave{selectedCount > 1 ? 'r' : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil slette {selectedCount} oppgave{selectedCount > 1 ? 'r' : ''}? Denne handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isProcessing}
              className="bg-ab-danger text-ab-on-accent hover:bg-ab-danger/90"
            >
              {isProcessing ? (
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

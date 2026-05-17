"use client";

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Todo } from '@/types/todo';
import { Checkbox } from '@/components/ui/checkbox';
import { GripVertical, Shield } from 'lucide-react';

interface TodoCardProps {
  todo: Todo;
  onUpdate: (todo: Todo) => void;
  onClick?: (todo: Todo) => void;
  isMobile?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (checked: boolean) => void;
}

export function TodoCard({ todo, onUpdate, onClick, isMobile = false, isSelected = false, onSelectionChange }: TodoCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: todo.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : 1, // Hide original card completely during drag
  };

  const getPriorityTone = (priority: string): 'danger' | 'warn' | 'info' => {
    switch (priority) {
      case 'high': return 'danger';
      case 'medium': return 'warn';
      case 'low': return 'info';
      default: return 'info';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const handleCheckboxChange = (checked: boolean) => {
    onSelectionChange?.(checked);
  };

  // On mobile, make entire card draggable except checkbox
  const cardProps = isMobile ? {
    ...attributes,
    ...listeners,
    style: {
      ...style,
      touchAction: 'none', // Prevent default touch behaviors during drag
    }
  } : { style };

  const isCompleted = todo.status === 'completed';
  const priorityTone = getPriorityTone(todo.priority);

  return (
    <div
      ref={setNodeRef}
      {...cardProps}
      className={`group relative ab-card rounded-ab-md cursor-pointer transition-[transform,colors,border-color] duration-[180ms] hover:border-ab-line-2 hover:bg-ab-hover/40 hover:-translate-y-px active:scale-[0.99] ${
        isDragging ? 'shadow-lg' : ''
      } ${isSelected ? 'ring-1 ring-ab-accent' : ''} ${
        todo.is_admin_assigned ? 'border-l-2 border-l-ab-accent' : ''
      } ${isMobile ? 'touch-manipulation' : ''} ${isCompleted ? 'opacity-60' : ''}`}
      onClick={(e) => {
        // Prevent click during drag
        if (isDragging) return;

        // Prevent click on drag handle or checkbox
        if (e.target instanceof Element &&
            (e.target.closest('[data-drag-handle]') || e.target.closest('[data-checkbox]'))) {
          return;
        }

        onClick?.(todo);
      }}
    >
      <div className={isMobile ? 'px-3 py-2.5' : 'px-3.5 py-3'}>
        {/* Row 1 */}
        <div className="flex items-center gap-2">
          {/* Checkbox for bulk selection */}
          {onSelectionChange && (
            <div
              data-checkbox
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className="flex items-center"
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={handleCheckboxChange}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {/* Drag Handle - Hidden on mobile */}
          {!isMobile && (
            <div
              {...attributes}
              {...listeners}
              data-drag-handle
              className="cursor-grab active:cursor-grabbing text-ab-fg-3 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </div>
          )}

          {/* Title */}
          <h4 className={`flex-1 min-w-0 text-[13px] font-semibold leading-snug text-ab-fg truncate ${
            isCompleted ? 'line-through text-ab-fg-3' : ''
          }`}>
            {todo.title}
          </h4>

          {/* Admin chip */}
          {todo.is_admin_assigned && (
            <span className="ab-pill info shrink-0" style={{ padding: '2px 6px', fontSize: '10px' }}>
              <Shield className="h-3 w-3" />
              Admin
            </span>
          )}

          {/* Priority pill */}
          <span className={`ab-pill ${priorityTone} shrink-0`} style={{ padding: '2px 6px', fontSize: '10px' }}>
            {todo.priority_display}
          </span>

          {/* Date */}
          {todo.deadline && (
            <span className="mono text-[11px] text-ab-fg-3 shrink-0">
              {formatDate(todo.deadline)}
            </span>
          )}
        </div>

        {/* Row 2: description */}
        {todo.description && (
          <p className="mt-1.5 text-[11px] text-ab-fg-3 line-clamp-1">
            {todo.description}
          </p>
        )}

        {/* Row 3: overdue + meta */}
        {(todo.is_overdue || (!isMobile && todo.user_name)) && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-ab-fg-3">
            {todo.is_overdue && (
              <span className="ab-pill danger" style={{ padding: '2px 6px', fontSize: '10px' }}>
                Fristen har utgått
              </span>
            )}
            {!isMobile && todo.is_admin_assigned && todo.assigned_by && (
              <span className="text-[11px] text-ab-fg-3 truncate">
                fra {todo.assigned_by.username}
              </span>
            )}
            {!isMobile && !todo.is_admin_assigned && (
              <span className="ml-auto truncate max-w-[100px]">{todo.user_name}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

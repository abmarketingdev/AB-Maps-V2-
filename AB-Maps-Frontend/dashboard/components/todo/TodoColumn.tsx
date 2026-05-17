"use client";

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Todo } from '@/types/todo';
import { TodoCard } from './TodoCard';
import { Plus, Inbox } from 'lucide-react';

interface TodoColumnProps {
  id: string;
  title: string;
  todos: Todo[];
  status: 'pending' | 'in_progress' | 'completed';
  onTodoUpdate: (todo: Todo) => void;
  onTodoClick: (todo: Todo) => void;
  onCreateTodo?: () => void;
  onRefresh: () => void;
  isMobile?: boolean;
  selectedTodos?: string[];
  onSelectionChange?: (todoIds: string[]) => void;
  emptyMessage: string;
  emptySubMessage: string;
}

export function TodoColumn({
  id,
  title,
  todos,
  status,
  onTodoUpdate,
  onTodoClick,
  onCreateTodo,
  onRefresh,
  isMobile = false,
  selectedTodos = [],
  onSelectionChange,
  emptyMessage,
  emptySubMessage
}: TodoColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  const handleCreateTodo = () => {
    onCreateTodo?.();
  };

  return (
    <div
      ref={setNodeRef}
      className={`transition-colors rounded-ab-lg ${isOver ? 'bg-ab-hover/30' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-9 px-1 mb-2">
        <div className="flex items-center gap-2">
          <span className="eyebrow">{title}</span>
          <span className="mono text-[11px] text-ab-fg-3">{todos.length}</span>
        </div>

        {/* Desktop create button - Hidden on mobile (FAB used instead) */}
        {!isMobile && status === 'pending' && onCreateTodo && (
          <button
            type="button"
            onClick={handleCreateTodo}
            className="ab-btn icon ghost"
            aria-label="Opprett oppgave"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className={`flex flex-col gap-2 ${
        isMobile ? 'min-h-[150px]' : 'min-h-[200px]'
      }`}>
        {todos.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-8 border border-dashed border-ab-line-1 rounded-ab-md">
            <Inbox className="h-4 w-4 text-ab-fg-4 mb-1.5" />
            <p className="text-[12px] text-ab-fg-3">
              {emptyMessage}
            </p>
            {emptySubMessage && (
              <p className="mt-0.5 text-[11px] text-ab-fg-4">
                {emptySubMessage}
              </p>
            )}
            {isOver && (
              <p className="text-[12px] mt-2 text-ab-accent">
                Slipp her
              </p>
            )}
          </div>
        ) : (
          <>
            {todos.map((todo) => (
              <TodoCard
                key={todo.id}
                todo={todo}
                onUpdate={onTodoUpdate}
                onClick={onTodoClick}
                isMobile={isMobile}
                isSelected={selectedTodos.includes(todo.id)}
                onSelectionChange={onSelectionChange ? (checked) => {
                  if (checked) {
                    onSelectionChange([...selectedTodos, todo.id]);
                  } else {
                    onSelectionChange(selectedTodos.filter(id => id !== todo.id));
                  }
                } : undefined}
              />
            ))}
            {isOver && (
              <div className="h-px bg-ab-accent" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

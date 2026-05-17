"use client";

import React from 'react';
import { TodoBoard } from '@/components/todo/TodoBoard';

export default function TodoPage() {
  return (
    <div className="relative flex-1 min-h-screen bg-ab-base bg-page-glow">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.035] dark:opacity-[0.06]"
        style={{
          maskImage: "linear-gradient(to bottom, black, transparent 70%)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent 70%)",
        }}
      />
      <div className="relative z-10">
        <TodoBoard />
      </div>
    </div>
  );
}

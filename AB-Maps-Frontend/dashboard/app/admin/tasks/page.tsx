"use client";

// Legacy admin-task assignment page. Superseded by the live multi-assignee task
// board at /todo (backed by /api/todos/v2/tasks/). The old backend resource
// (/api/todos/admin/assigned-tasks/) no longer exists, so this route now
// redirects to the working board instead of rendering a broken page.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminTasksPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/todo');
  }, [router]);
  return null;
}

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { type Task } from '../gen/api';
import { Button } from './ui/button';
import { TimerManager } from './TimerManager';

interface TaskSideMenuProps {
  task: Task | null;
  onClose: () => void;
}

export const TaskSideMenu: React.FC<TaskSideMenuProps> = ({ task, onClose }) => {
  useEffect(() => {
    if (!task) return undefined;
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [task, onClose]);

  if (!task) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-foreground/20"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-border bg-card shadow-2xl">
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Task Details
              </p>
              <h3 className="truncate text-lg font-semibold text-foreground" title={task.title}>
                {task.title}
              </h3>
            </div>
            <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close details">
              <X className="h-4 w-4" />
            </Button>
          </header>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Description
              </h4>
              {task.description ? (
                <p className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
                  {task.description}
                </p>
              ) : (
                <p className="mt-2 text-sm italic text-muted-foreground">No description provided.</p>
              )}
            </section>

            <section>
              <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Details
              </h4>
              <dl className="mt-3 grid grid-cols-2 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium text-foreground">To Do</dd>

                <dt className="text-muted-foreground">Due Date</dt>
                <dd className="text-foreground">
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'None'}
                </dd>

                <dt className="text-muted-foreground">Created</dt>
                <dd className="text-foreground">{new Date(task.createdAt).toLocaleDateString()}</dd>

                <dt className="text-muted-foreground">Updated</dt>
                <dd className="text-foreground">{new Date(task.updatedAt).toLocaleDateString()}</dd>
              </dl>
            </section>

            <section>
              <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Timers
              </h4>
              <div className="mt-3 rounded-lg border border-border bg-muted/20 p-4">
                <TimerManager taskId={task.id} />
              </div>
            </section>
          </div>
        </div>
      </aside>
    </>
  );
};

import { TaskStatus, type Task } from '@lyra/shared';

// Kanban column order for the task board.
export const TASK_STATUS_ORDER: TaskStatus[] = [
  TaskStatus.New,
  TaskStatus.InProgress,
  TaskStatus.OnHold,
  TaskStatus.Complete,
];

// Token-based tint per status — column-header dot + card accent. Never hardcode.
export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  [TaskStatus.New]: 'var(--ink-tertiary)',
  [TaskStatus.InProgress]: 'var(--accent-projects)',
  [TaskStatus.OnHold]: 'var(--warning)',
  [TaskStatus.Complete]: 'var(--success)',
};

// Bucket tasks by status into a column-keyed map (every column present, in order).
// An unknown status falls back to New so a task is never dropped from the board.
export function groupTasksByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const out = {
    [TaskStatus.New]: [] as Task[],
    [TaskStatus.InProgress]: [] as Task[],
    [TaskStatus.OnHold]: [] as Task[],
    [TaskStatus.Complete]: [] as Task[],
  };
  for (const task of tasks) {
    (out[task.status] ?? out[TaskStatus.New]).push(task);
  }
  return out;
}

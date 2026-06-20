import { TaskPriority } from '@lyra/shared';

// Picker display order (Linear-style): no priority first, then Urgent → Low.
export const TASK_PRIORITY_ORDER: TaskPriority[] = [
  TaskPriority.None,
  TaskPriority.Urgent,
  TaskPriority.High,
  TaskPriority.Medium,
  TaskPriority.Low,
];

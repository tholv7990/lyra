import { TaskStatus } from '@lyra/shared';
import { TASK_STATUS_COLOR } from '../lib/taskStatus';

// Linear-style workflow status icons:
//  New         → empty circle (todo)
//  In progress → outline circle with a half-filled pie (started)
//  On hold     → dashed circle (paused)
//  Complete    → filled circle with a check (done)
// Colour comes from the shared status palette, applied via currentColor.
export function TaskStatusIcon({ status, size = 16 }: { status: TaskStatus; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      style={{ color: TASK_STATUS_COLOR[status], flexShrink: 0 }}
      aria-hidden="true"
    >
      {status === TaskStatus.New && (
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      )}
      {status === TaskStatus.InProgress && (
        <>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M8 3.2 A4.8 4.8 0 0 1 8 12.8 Z" fill="currentColor" />
        </>
      )}
      {status === TaskStatus.OnHold && (
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="2.2 2.3" />
      )}
      {status === TaskStatus.Complete && (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M4.9 8.2 l2 2 l4.1 -4.3" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

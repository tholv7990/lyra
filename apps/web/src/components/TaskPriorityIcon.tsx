import { TaskPriority } from '@lyra/shared';

// Linear-style priority icons:
//  None    → three faint horizontal bars (no priority)
//  Low/Med/High → three ascending bars, 1/2/3 filled
//  Urgent  → filled amber square with a white "!"
const BARS = [
  { x: 2.4, y: 9, h: 4 },
  { x: 6.7, y: 6, h: 7 },
  { x: 11, y: 3, h: 10 },
];
const FILLED: Record<TaskPriority, number> = {
  [TaskPriority.None]: 0,
  [TaskPriority.Low]: 1,
  [TaskPriority.Medium]: 2,
  [TaskPriority.High]: 3,
  [TaskPriority.Urgent]: 0,
};

export function TaskPriorityIcon({ priority, size = 16 }: { priority: TaskPriority; size?: number }) {
  if (priority === TaskPriority.Urgent) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" style={{ flexShrink: 0 }} aria-hidden="true">
        <rect x="1.5" y="1.5" width="13" height="13" rx="3.5" fill="var(--warning)" />
        <rect x="7.1" y="3.8" width="1.8" height="5.2" rx="0.9" fill="#fff" />
        <rect x="7.1" y="10.4" width="1.8" height="1.8" rx="0.9" fill="#fff" />
      </svg>
    );
  }
  if (priority === TaskPriority.None) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" style={{ color: 'var(--ink-tertiary)', flexShrink: 0 }} aria-hidden="true">
        {[4, 8, 12].map((y) => (
          <rect key={y} x="3" y={y - 0.8} width="10" height="1.6" rx="0.8" fill="currentColor" />
        ))}
      </svg>
    );
  }
  const filled = FILLED[priority];
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ color: 'var(--ink-muted)', flexShrink: 0 }} aria-hidden="true">
      {BARS.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width="2.6" height={b.h} rx="1" fill="currentColor" opacity={i < filled ? 1 : 0.28} />
      ))}
    </svg>
  );
}

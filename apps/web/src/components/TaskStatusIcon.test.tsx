/**
 * Smoke test: TaskStatusIcon — the SVG status circle variants used in
 * kanban task cards. Rendered via renderToStaticMarkup (no jsdom/RTL).
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { TaskPriority, TaskStatus } from '@lyra/shared';
import { TaskStatusIcon } from './TaskStatusIcon';
import { TASK_STATUS_COLOR, TASK_STATUS_ORDER, groupTasksByStatus } from '../lib/taskStatus';
import type { Task } from '@lyra/shared';

describe('TaskStatusIcon', () => {
  test('renders an svg for every TaskStatus', () => {
    for (const status of Object.values(TaskStatus)) {
      const html = renderToStaticMarkup(<TaskStatusIcon status={status} size={15} />);
      expect(html).toContain('<svg');
      expect(html).toContain('aria-hidden="true"');
    }
  });

  test('New renders an open circle (no fill)', () => {
    const html = renderToStaticMarkup(<TaskStatusIcon status={TaskStatus.New} />);
    expect(html).toContain('fill="none"');
    expect(html).not.toContain('fill="currentColor"');
  });

  test('Complete renders a filled circle with a check path', () => {
    const html = renderToStaticMarkup(<TaskStatusIcon status={TaskStatus.Complete} />);
    // filled background circle
    expect(html).toContain('fill="currentColor"');
    // checkmark (white stroke)
    expect(html).toContain('stroke="#fff"');
  });

  test('OnHold renders a dashed stroke', () => {
    const html = renderToStaticMarkup(<TaskStatusIcon status={TaskStatus.OnHold} />);
    // renderToStaticMarkup serialises camelCase props as kebab HTML attributes
    expect(html).toContain('stroke-dasharray');
  });

  test('TASK_STATUS_ORDER contains all four statuses', () => {
    expect(TASK_STATUS_ORDER).toHaveLength(4);
    expect(TASK_STATUS_ORDER).toContain(TaskStatus.New);
    expect(TASK_STATUS_ORDER).toContain(TaskStatus.InProgress);
    expect(TASK_STATUS_ORDER).toContain(TaskStatus.OnHold);
    expect(TASK_STATUS_ORDER).toContain(TaskStatus.Complete);
  });

  test('TASK_STATUS_COLOR maps every status to a CSS token (var(--...))', () => {
    for (const status of Object.values(TaskStatus)) {
      expect(TASK_STATUS_COLOR[status]).toMatch(/^var\(--/);
    }
  });
});

describe('groupTasksByStatus', () => {
  function makeTask(id: string, status: TaskStatus): Task {
    return {
      id,
      projectId: 'p1',
      workspaceId: 'w1',
      name: id,
      description: '',
      active: true,
      status,
      priority: TaskPriority.None,
      tags: [],
      pipelines: [],
      runs: { total: 0, running: 0, awaitingGate: 0, done: 0 },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      createdBy: { id: 'u1', name: 'Alice' },
      updatedBy: { id: 'u1', name: 'Alice' },
    };
  }

  test('empty list returns all four columns empty', () => {
    const grouped = groupTasksByStatus([]);
    for (const status of Object.values(TaskStatus)) {
      expect(grouped[status]).toEqual([]);
    }
  });

  test('tasks land in the correct column', () => {
    const tasks = [
      makeTask('t1', TaskStatus.New),
      makeTask('t2', TaskStatus.InProgress),
      makeTask('t3', TaskStatus.Complete),
      makeTask('t4', TaskStatus.New),
    ];
    const grouped = groupTasksByStatus(tasks);
    expect(grouped[TaskStatus.New]).toHaveLength(2);
    expect(grouped[TaskStatus.InProgress]).toHaveLength(1);
    expect(grouped[TaskStatus.OnHold]).toHaveLength(0);
    expect(grouped[TaskStatus.Complete]).toHaveLength(1);
  });
});

import { describe, it, expect } from 'vitest';
import { TaskStatus, type Task } from '@lyra/shared';
import { groupTasksByStatus, TASK_STATUS_ORDER } from './taskStatus';

const mk = (id: string, status: TaskStatus): Task =>
  ({ id, status, name: id, pipelines: [], workspaceId: 'w', projectId: 'p', description: '' } as unknown as Task);

describe('groupTasksByStatus', () => {
  it('buckets tasks into all four columns, in order', () => {
    const grouped = groupTasksByStatus([
      mk('a', TaskStatus.New),
      mk('b', TaskStatus.Complete),
      mk('c', TaskStatus.New),
      mk('d', TaskStatus.OnHold),
    ]);
    expect(Object.keys(grouped)).toEqual(TASK_STATUS_ORDER);
    expect(grouped[TaskStatus.New].map((t) => t.id)).toEqual(['a', 'c']);
    expect(grouped[TaskStatus.OnHold].map((t) => t.id)).toEqual(['d']);
    expect(grouped[TaskStatus.Complete].map((t) => t.id)).toEqual(['b']);
    expect(grouped[TaskStatus.InProgress]).toEqual([]);
  });

  it('falls back an unknown status to New rather than dropping the task', () => {
    const grouped = groupTasksByStatus([mk('x', 'weird' as TaskStatus)]);
    expect(grouped[TaskStatus.New].map((t) => t.id)).toEqual(['x']);
  });
});

import { ProjectStatus, ProjectShare } from '@lyra/shared';
import { toProject } from './project.views';
import type { ProjectDocument } from './project.schema';

// Minimal project doc with just the fields toProject reads.
function doc(over: Partial<Record<string, unknown>> = {}): ProjectDocument {
  return {
    _id: { toString: () => 'p1' },
    workspaceId: 'ws1',
    name: 'Test',
    description: '',
    variables: [],
    status: ProjectStatus.Draft,
    shared: ProjectShare.All,
    sharedWith: [],
    channels: [],
    active: true,
    createdBy: 'u1',
    updatedBy: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as unknown as ProjectDocument;
}

describe('toProject channels', () => {
  it('serializes the selected channels', () => {
    const view = toProject(doc({ channels: ['mock-tt', 'mock-ig'] }), new Map());
    expect(view.channels).toEqual(['mock-tt', 'mock-ig']);
  });

  it('defaults channels to [] for a legacy doc without the field', () => {
    const view = toProject(doc({ channels: undefined }), new Map());
    expect(view.channels).toEqual([]);
  });
});

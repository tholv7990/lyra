import { WorkspaceType } from '@lyra/shared';
import { WorkspacesService } from './workspaces.service';

// Chainable exec stub
function execOf(value: unknown) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

describe('WorkspacesService.upgradeToTeam', () => {
  function makeService(findOneAndUpdateResult: unknown) {
    const model = {
      findOneAndUpdate: jest.fn().mockReturnValue(execOf(findOneAndUpdateResult)),
    } as never;
    const memberships = { listForUser: jest.fn().mockResolvedValue([]) } as never;
    const users = { refMap: jest.fn().mockResolvedValue(new Map()) } as never;
    return new WorkspacesService(model, memberships, users);
  }

  it('calls findOneAndUpdate with personal filter and returns updated doc', async () => {
    const updatedDoc = { _id: 'ws1', id: 'ws1', type: WorkspaceType.Team };
    const service = makeService(updatedDoc);
    const result = await service.upgradeToTeam('ws1', 'user1');
    expect(result).toEqual(updatedDoc);
    expect((service as any).model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'ws1', type: WorkspaceType.Personal },
      { $set: { type: WorkspaceType.Team, updatedBy: 'user1' } },
      { returnDocument: 'after' },
    );
  });

  it('returns null when workspace not found or already team', async () => {
    const service = makeService(null);
    const result = await service.upgradeToTeam('ws1', 'user1');
    expect(result).toBeNull();
  });
});

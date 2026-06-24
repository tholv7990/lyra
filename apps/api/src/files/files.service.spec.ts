import { NotFoundException } from '@nestjs/common';
import { FilesService } from './files.service';

// A valid 24-hex ObjectId string so `new ObjectId(id)` doesn't throw.
const VALID_ID = '0123456789abcdef01234567';

function svcWithFile(metadata: Record<string, unknown>) {
  const svc = new FilesService({} as never);
  const file = { _id: VALID_ID, filename: 'f.png', length: 3, metadata };
  jest.spyOn(svc as unknown as { bucket: () => unknown }, 'bucket').mockReturnValue({
    find: () => ({ limit: () => ({ toArray: async () => [file] }) }),
    openDownloadStream: () => ({}),
  });
  return svc;
}

describe('FilesService.open — workspace fence (Vector 1)', () => {
  it('returns the file when workspaceId matches the file metadata', async () => {
    const svc = svcWithFile({ workspaceId: 'ws-A' });
    await expect(svc.open(VALID_ID, 'ws-A')).resolves.toHaveProperty('file');
  });

  it('throws NotFound when workspaceId does NOT match (cross-tenant read blocked)', async () => {
    const svc = svcWithFile({ workspaceId: 'ws-A' });
    await expect(svc.open(VALID_ID, 'ws-B')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows capability access (no workspaceId) — the public download route', async () => {
    const svc = svcWithFile({ workspaceId: 'ws-A' });
    await expect(svc.open(VALID_ID)).resolves.toHaveProperty('file');
  });

  it('readBuffer enforces the workspace fence (cross-tenant → NotFound)', async () => {
    const svc = svcWithFile({ workspaceId: 'ws-A' });
    await expect(svc.readBuffer(VALID_ID, 'ws-B')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFound on an unparseable id', async () => {
    const svc = svcWithFile({ workspaceId: 'ws-A' });
    await expect(svc.open('not-an-objectid', 'ws-A')).rejects.toBeInstanceOf(NotFoundException);
  });
});

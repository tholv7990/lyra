import { ProductsService } from './products.service';

function svc(model: any) {
  return new ProductsService(model, { refMap: jest.fn().mockResolvedValue(new Map()) } as any);
}

describe('ProductsService results', () => {
  it('addResult pushes a SavedResult (with asset) onto the product', async () => {
    const saved: any = { _id: { toString: () => 'p1' }, workspaceId: 'ws', results: [], save: jest.fn().mockResolvedValue(undefined), createdBy: 'u', updatedBy: 'u' };
    const model = { findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(saved) }) };
    await svc(model).addResult('p1', 'ws', 'u', { output: 'ok', provider: 'google' as any, model: 'gemini', assetUrl: 'https://x/i.png', assetType: 'image', runId: 'r1', stepIndex: 2 });
    expect(saved.results).toHaveLength(1);
    expect(saved.results[0]).toMatchObject({ output: 'ok', assetUrl: 'https://x/i.png', assetType: 'image', createdBy: 'u' });
    expect(saved.save).toHaveBeenCalled();
  });
  it('removeResult is creator-or-owner gated', async () => {
    const saved: any = { createdBy: 'owner', results: [{ _id: { toString: () => 'res1' }, createdBy: 'someoneElse' }], save: jest.fn() };
    const model = { findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(saved) }) };
    await expect(svc(model).removeResult('p1', 'ws', 'intruder', 'res1')).rejects.toThrow();
  });
});

import { SaveProductAction } from './save-product.action';
const ctx = (over: any = {}) => ({ action: { type: 'save-product', productName: 'Dog Toy' }, step: {} as any, workspaceId: 'ws', projectId: 'noProjectId' in over ? over.noProjectId : 'p1', priorResults: [],
  ledger: { evidence: [{ id: 'c1', statement: 'a', kind: 'estimate', sourceId: 's1' }], sources: [{ id: 's1', name: 'S', url: 'u', accessDate: 'd', primary: false, alive: true }], data: { unitEcon: { cm1: 5 }, score: 80, grade: 'B', decision: 'TEST_NOW', subScores: {} }, variables: {} } }) as any;
describe('SaveProductAction', () => {
  it('saves the ledger to a Product and returns its id', async () => {
    const products = { saveResearch: jest.fn().mockResolvedValue('prod-1') };
    const out = await new SaveProductAction(products as any).execute(ctx());
    expect(products.saveResearch).toHaveBeenCalledWith('p1', 'ws', expect.any(String), expect.objectContaining({ name: 'Dog Toy', score: 80, decision: 'TEST_NOW' }));
    expect((out.data as any).productId).toBe('prod-1');
  });
  it('skips persist on a builder test run (no projectId)', async () => {
    const products = { saveResearch: jest.fn() };
    const out = await new SaveProductAction(products as any).execute(ctx({ noProjectId: undefined }));
    expect(products.saveResearch).not.toHaveBeenCalled();
    expect(out.result).toMatch(/no project|test run/i);
  });
});

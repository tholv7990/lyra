import { SaveProductAction } from './save-product.action';
const ctx = (over: any = {}) => ({ action: { type: 'save-product' }, step: {} as any, workspaceId: 'ws', productId: 'noProductId' in over ? over.noProductId : 'p1', priorResults: [],
  ledger: { evidence: [{ id: 'c1', statement: 'a', kind: 'estimate', sourceId: 's1' }], sources: [{ id: 's1', name: 'S', url: 'u', accessDate: 'd', primary: false, alive: true }], data: { unitEcon: { cm1: 5 }, score: 80, grade: 'B', decision: 'TEST_NOW', subScores: {} }, variables: {} } }) as any;
describe('SaveProductAction', () => {
  it('saves the ledger to a Product via applyResearch', async () => {
    const products = { applyResearch: jest.fn().mockResolvedValue({ id: 'p1' }) };
    const out = await new SaveProductAction(products as any).execute(ctx());
    expect(products.applyResearch).toHaveBeenCalledWith('p1', 'ws', 'system', expect.objectContaining({ score: 80, decision: 'TEST_NOW' }));
    expect((out.data as any).productId).toBe('p1');
  });
  it('skips persist on a builder test run (no productId)', async () => {
    const products = { applyResearch: jest.fn() };
    const out = await new SaveProductAction(products as any).execute(ctx({ noProductId: undefined }));
    expect(products.applyResearch).not.toHaveBeenCalled();
    expect(out.result).toMatch(/no product|test run/i);
  });
});

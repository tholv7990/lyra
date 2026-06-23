// Hoist project-owned Products to the workspace pool: record provenance in
// originatingProjectId and remove projectId (research is product-level now).
// Idempotent: only processes docs that still carry projectId. Reversible.
//
// Deploy the Phase-1 code together with this migration (the new code reads
// workspace-scoped products; this removes the project link).
module.exports = {
  async up(db) {
    const products = db.collection('products');
    await products.updateMany(
      { projectId: { $exists: true } },
      [{ $set: { originatingProjectId: '$projectId' } }, { $unset: 'projectId' }],
    );
    await products.createIndex({ workspaceId: 1, status: 1, createdAt: -1 });
  },
  async down(db) {
    const products = db.collection('products');
    await products.updateMany(
      { originatingProjectId: { $exists: true } },
      [{ $set: { projectId: '$originatingProjectId' } }, { $unset: 'originatingProjectId' }],
    );
  },
};

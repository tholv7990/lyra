// Project model v2 — migrate existing projects to the new shape:
//   - description      ← old `product`
//   - variables[]      ← non-empty subset of {product, niche, homepage}
//   - status           ← visibility: private → draft, else public
//   - shared           ← visibility: shared → people, else all
//   - sharedWith       ← preserved
//   - pipelines[]      ← active ProjectPipeline rows for this project
//   - active           ← preserved
// Old columns (product/niche/homepageUrl/visibility) are removed after copy.
//
// Idempotent: `up` only touches docs that still carry the old `visibility`
// field; re-running it is a no-op. The `projectpipelines` join collection is
// retired (its rows are read once, then `project.pipelines` is the source of
// truth).

// [variable key, old project field]
const VAR_KEYS = [
  ['product', 'product'],
  ['niche', 'niche'],
  ['homepage', 'homepageUrl'],
];

module.exports = {
  async up(db) {
    const projects = db.collection('projects');
    const links = db.collection('projectpipelines');

    const cursor = projects.find({ visibility: { $exists: true } });
    while (await cursor.hasNext()) {
      const p = await cursor.next();

      const variables = VAR_KEYS.map(([key, field]) => ({
        key,
        value: (p[field] ?? '').toString(),
      })).filter((v) => v.value.trim() !== '');

      const status = p.visibility === 'private' ? 'draft' : 'public';
      const shared = p.visibility === 'shared' ? 'people' : 'all';

      // pipelines: distinct ids from this project's active join rows.
      const rows = await links
        .find({ projectId: p._id.toString(), active: { $ne: false } })
        .toArray();
      const pipelines = [...new Set(rows.map((r) => r.pipelineId))];

      await projects.updateOne(
        { _id: p._id },
        {
          $set: {
            description: (p.product ?? '').toString(),
            variables,
            status,
            shared,
            sharedWith: Array.isArray(p.sharedWith) ? p.sharedWith : [],
            pipelines,
          },
          $unset: {
            product: '',
            niche: '',
            homepageUrl: '',
            visibility: '',
          },
        },
      );
    }

    // Index swap: old {workspaceId, visibility} → {workspaceId, status}.
    try {
      await projects.dropIndex('workspaceId_1_visibility_1');
    } catch {
      // index may not exist (fresh DB / already dropped) — ignore.
    }
    await projects.createIndex({ workspaceId: 1, status: 1 });
    await projects.createIndex({ workspaceId: 1, createdBy: 1 });
  },

  async down(db) {
    const projects = db.collection('projects');

    const cursor = projects.find({
      status: { $exists: true },
      visibility: { $exists: false },
    });
    while (await cursor.hasNext()) {
      const p = await cursor.next();
      const byKey = Object.fromEntries(
        (p.variables ?? []).map((v) => [v.key, v.value]),
      );
      const visibility =
        p.status === 'draft'
          ? 'private'
          : p.shared === 'people'
            ? 'shared'
            : 'workspace';

      await projects.updateOne(
        { _id: p._id },
        {
          $set: {
            product: byKey.product ?? p.description ?? '',
            niche: byKey.niche ?? '',
            homepageUrl: byKey.homepage ?? '',
            visibility,
          },
          $unset: {
            description: '',
            variables: '',
            status: '',
            shared: '',
            pipelines: '',
          },
        },
      );
    }

    try {
      await projects.dropIndex('workspaceId_1_status_1');
    } catch {
      // ignore
    }
    await projects.createIndex({ workspaceId: 1, visibility: 1 });
  },
};

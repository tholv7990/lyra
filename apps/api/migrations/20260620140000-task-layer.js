// Task layer — give every existing project one default "General" task that
// adopts the project's pipelines, and repoint that project's runs to it.
//   - tasks: one per project (name 'General', status 'new', pipelines ← project.pipelines)
//   - runs:  taskId ← the new task's id (matched by projectId)
//   - project.pipelines is removed (it now lives on the task)
//
// Idempotent: `up` only processes projects that still carry a `pipelines` field
// (it unsets it after creating the task), so re-running is a no-op.
//
// IMPORTANT: deploy the Task-layer code together with this migration. The new
// code reads `task.pipelines`; running this before the code would hide pipelines
// from the (old) UI, and running the new code before this would leave existing
// projects with no task.

const { ObjectId } = require('mongodb');

module.exports = {
  async up(db) {
    const projects = db.collection('projects');
    const tasks = db.collection('tasks');
    const runs = db.collection('runs');

    const cursor = projects.find({ pipelines: { $exists: true } });
    while (await cursor.hasNext()) {
      const p = await cursor.next();
      const now = new Date();
      const projectId = p._id.toString();

      const res = await tasks.insertOne({
        workspaceId: p.workspaceId,
        projectId,
        name: 'General',
        description: '',
        status: 'new',
        pipelines: Array.isArray(p.pipelines) ? p.pipelines : [],
        active: true,
        createdBy: p.createdBy,
        updatedBy: p.updatedBy ?? p.createdBy,
        createdAt: now,
        updatedAt: now,
      });
      const taskId = res.insertedId.toString();

      await runs.updateMany({ projectId }, { $set: { taskId } });
      await projects.updateOne({ _id: p._id }, { $unset: { pipelines: '' } });
    }

    await tasks.createIndex({ projectId: 1, createdAt: -1 });
    await tasks.createIndex({ workspaceId: 1 });
    await tasks.createIndex({ status: 1 });
  },

  async down(db) {
    const projects = db.collection('projects');
    const tasks = db.collection('tasks');
    const runs = db.collection('runs');

    // Restore each project's pipelines from its default "General" task.
    const cursor = tasks.find({ name: 'General' });
    while (await cursor.hasNext()) {
      const t = await cursor.next();
      try {
        await projects.updateOne(
          { _id: new ObjectId(t.projectId) },
          { $set: { pipelines: Array.isArray(t.pipelines) ? t.pipelines : [] } },
        );
      } catch {
        // unparseable projectId — skip
      }
    }
    await runs.updateMany({ taskId: { $exists: true } }, { $unset: { taskId: '' } });
    await tasks.drop().catch(() => {});
  },
};

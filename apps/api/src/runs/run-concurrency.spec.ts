import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { RunSchema, Run } from './run.schema';

describe('Run optimistic concurrency', () => {
  let mongod: MongoMemoryServer;
  let conn: mongoose.Connection;
  let model: mongoose.Model<any>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    conn = await mongoose.createConnection(mongod.getUri()).asPromise();
    model = conn.model(Run.name, RunSchema);
  });
  afterAll(async () => { await conn.close(); await mongod.stop(); });

  it('throws VersionError when a stale copy is saved over a newer one', async () => {
    const created = await model.create({ workspaceId: 'ws', createdBy: 'u', updatedBy: 'u', status: 'idle', currentStep: 0, steps: [] });
    const a = await model.findById(created._id);
    const b = await model.findById(created._id);
    a!.status = 'running'; await a!.save();           // wins, bumps __v
    b!.status = 'stopped';
    await expect(b!.save()).rejects.toMatchObject({ name: 'VersionError' });
  });
});

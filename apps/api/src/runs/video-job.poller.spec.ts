import { VideoJobPoller } from './video-job.poller';
import { StepStatus } from '@lyra/shared';

// A doc whose toState() yields a Running step with a jobId at index 0.
const doc = () => ({ _id: 'r1', workspaceId: 'ws', status: 'running', steps: [{ index: 0, status: StepStatus.Running, jobId: 'j1', model: 'minimax/video-01', startedAt: new Date().toISOString() }] }) as any;

function make(pred: any) {
  const runs = { findInFlightAsync: jest.fn().mockResolvedValue([doc()]), resumeAfterAsync: jest.fn().mockResolvedValue({}), failAsyncStep: jest.fn().mockResolvedValue({}), updateAsyncProgress: jest.fn().mockResolvedValue({}) };
  const keys = { getDecrypted: jest.fn().mockResolvedValue('tok') };
  const replicate = { get: jest.fn().mockResolvedValue(pred), progressOf: jest.fn().mockReturnValue(50) };
  const video = { finalize: jest.fn().mockResolvedValue({ result: 'done', assets: [] }) };
  return { poller: new VideoJobPoller(runs as never, keys as never, replicate as never, video as never), runs, video };
}

describe('VideoJobPoller', () => {
  it('succeeded → finalize + resumeAfterAsync', async () => {
    const { poller, runs, video } = make({ status: 'succeeded', output: ['u'] });
    await poller.tick();
    expect(video.finalize).toHaveBeenCalled();
    expect(runs.resumeAfterAsync).toHaveBeenCalledWith(expect.anything(), 0, expect.anything(), 'system');
  });
  it('failed → failAsyncStep', async () => {
    const { poller, runs } = make({ status: 'failed', error: 'boom' });
    await poller.tick();
    expect(runs.failAsyncStep).toHaveBeenCalledWith(expect.anything(), 0, expect.stringMatching(/failed/i));
  });
  it('processing → updateAsyncProgress', async () => {
    const { poller, runs } = make({ status: 'processing' });
    await poller.tick();
    expect(runs.updateAsyncProgress).toHaveBeenCalledWith(expect.anything(), 0, 50);
  });
});

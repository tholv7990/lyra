import { PublishController } from './publish.controller';
import { UnauthorizedException } from '@nestjs/common';

function make() {
  const svc = {
    publish: jest.fn().mockReturnValue({ jobId: 'j1', status: 'queued' }),
    channels: jest.fn().mockResolvedValue([]),
    job: jest.fn().mockReturnValue({ jobId: 'j1', status: 'done', receipts: [] }),
    connectUrl: jest.fn().mockReturnValue({ url: 'http://localhost:5000' }),
  };
  return { c: new PublishController(svc as never), svc };
}

describe('PublishController', () => {
  it('publish forwards the body + key to the service', () => {
    const { c, svc } = make();
    expect(c.publish({ channelIds: ['i1'], caption: 'x', mediaUrls: [] }, 'key')).toEqual({ jobId: 'j1', status: 'queued' });
    expect(svc.publish).toHaveBeenCalledWith('key', { channelIds: ['i1'], caption: 'x', mediaUrls: [] });
  });
  it('rejects channels/publish without a connector key', () => {
    const { c } = make();
    expect(() => c.publish({ channelIds: [], caption: '', mediaUrls: [] }, undefined)).toThrow(UnauthorizedException);
    return expect(c.channels(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('jobs/:id falls back to a failed shell when the job is gone', () => {
    const { c, svc } = make();
    svc.job.mockReturnValueOnce(null);
    expect(c.job('missing')).toEqual({ jobId: 'missing', status: 'failed', receipts: [] });
  });
});

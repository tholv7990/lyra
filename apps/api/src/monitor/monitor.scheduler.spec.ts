import { MonitorScheduler } from './monitor.scheduler';

describe('MonitorScheduler.daily', () => {
  it('daily() runs the monitor for each workspace with a watching competitor', async () => {
    const competitors = { distinct: jest.fn().mockReturnValue({ exec: () => Promise.resolve(['ws1', 'ws2']) }) };
    const monitor = { runDaily: jest.fn().mockResolvedValue(undefined) };
    await new MonitorScheduler(competitors as never, monitor as never).daily();
    expect(monitor.runDaily).toHaveBeenCalledWith('ws1');
    expect(monitor.runDaily).toHaveBeenCalledWith('ws2');
  });
});

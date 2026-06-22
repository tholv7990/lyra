import { Semaphore } from './concurrency';

describe('Semaphore', () => {
  it('runs at most `max` callbacks concurrently', async () => {
    const sem = new Semaphore(2);
    let active = 0;
    let peak = 0;
    const task = () =>
      sem.run(async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 10));
        active--;
      });
    await Promise.all([task(), task(), task(), task(), task()]);
    expect(peak).toBe(2); // never more than 2 in flight despite 5 queued
    expect(active).toBe(0); // all released
  });

  it('still runs every queued task', async () => {
    const sem = new Semaphore(1);
    const done: number[] = [];
    await Promise.all([1, 2, 3].map((n) => sem.run(async () => { done.push(n); })));
    expect(done.sort()).toEqual([1, 2, 3]);
  });

  it('releases the slot even when a task throws', async () => {
    const sem = new Semaphore(1);
    await expect(sem.run(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    // the next task must still acquire (slot was freed in finally)
    await expect(sem.run(async () => 'ok')).resolves.toBe('ok');
  });
});

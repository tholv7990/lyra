import { ConnectorsController } from './connectors.controller';
import { BadRequestException } from '@nestjs/common';

const user = { id: 'u1' } as never;

function make(usesService: boolean, key: string | null) {
  const proxy = { usesService: () => usesService, forward: jest.fn().mockResolvedValue({ ok: true }) };
  const creds = { getDecrypted: jest.fn().mockResolvedValue(key), upsert: jest.fn(), status: jest.fn() };
  return { c: new ConnectorsController(proxy as never, creds as never), proxy, creds };
}

describe('ConnectorsController key gating', () => {
  it('mock mode: forwards channels with no key (no throw)', async () => {
    const { c, proxy } = make(false, null);
    await c.channels('ws', user);
    expect(proxy.forward).toHaveBeenCalledWith('ws', 'u1', 'GET', 'channels', undefined, undefined);
  });
  it('real mode + key: forwards publish with the decrypted key', async () => {
    const { c, proxy } = make(true, 'pk');
    await c.publish('ws', user, { channelIds: ['i1'], caption: 'x', mediaUrls: [] } as never);
    expect(proxy.forward).toHaveBeenCalledWith('ws', 'u1', 'POST', 'publish', expect.anything(), 'pk');
  });
  it('real mode + no key: 400 before forwarding', async () => {
    const { c, proxy } = make(true, null);
    await expect(c.channels('ws', user)).rejects.toBeInstanceOf(BadRequestException);
    expect(proxy.forward).not.toHaveBeenCalled();
  });
});

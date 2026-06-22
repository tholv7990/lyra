import { BadRequestException } from '@nestjs/common';
import { CrawlerCookiesService } from './crawler-cookies.service';

const make = () => {
  const model = { findOneAndUpdate: jest.fn().mockReturnValue({ exec: () => Promise.resolve({ workspaceId: 'w', connector: 'crawler-cookies', updatedAt: new Date() }) }) };
  const encryption = { encrypt: jest.fn().mockReturnValue('enc') };
  return { svc: new CrawlerCookiesService(model as never, encryption as never), model, encryption };
};

describe('CrawlerCookiesService.set validation', () => {
  it('rejects a non-Netscape cookies body before storing', async () => {
    const { svc, model, encryption } = make();
    await expect(svc.set('w', 'just garbage text', 'actor')).rejects.toBeInstanceOf(BadRequestException);
    expect(encryption.encrypt).not.toHaveBeenCalled();
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('accepts a valid Netscape cookies body', async () => {
    const { svc, encryption } = make();
    await svc.set('w', '# Netscape HTTP Cookie File\n.x.com\tTRUE\t/\tTRUE\t1799999999\ta\tb', 'actor');
    expect(encryption.encrypt).toHaveBeenCalled();
  });
});

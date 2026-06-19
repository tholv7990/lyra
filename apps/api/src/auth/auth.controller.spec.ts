import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

function makeResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
  } as unknown as Response & {
    status: jest.Mock;
    type: jest.Mock;
    send: jest.Mock;
    redirect: jest.Mock;
  };
}

describe('AuthController', () => {
  let auth: { verifyEmail: jest.Mock };
  let controller: AuthController;

  beforeEach(() => {
    auth = { verifyEmail: jest.fn() };
    const config = { get: jest.fn(() => 'https://dev.getlyras.app') };
    controller = new AuthController(
      auth as unknown as AuthService,
      config as unknown as ConfigService,
    );
  });

  it('renders a verified account page instead of redirecting to the app', async () => {
    const res = makeResponse();

    await controller.verifyEmail('abc123', res);

    expect(auth.verifyEmail).toHaveBeenCalledWith('abc123');
    expect(res.redirect).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.type).toHaveBeenCalledWith('html');
    expect(res.send.mock.calls[0][0]).toContain('Your account is verified');
    expect(res.send.mock.calls[0][0]).toContain('href="https://dev.getlyras.app/login"');
  });

  it('renders an invalid confirmation page instead of redirecting to the app', async () => {
    auth.verifyEmail.mockRejectedValue(new Error('expired'));
    const res = makeResponse();

    await controller.verifyEmail('bad-token', res);

    expect(res.redirect).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.type).toHaveBeenCalledWith('html');
    expect(res.send.mock.calls[0][0]).toContain('Confirmation link expired');
  });
});

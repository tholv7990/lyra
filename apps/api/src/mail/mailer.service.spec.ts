import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailerService } from './mailer.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('MailerService', () => {
  const sendMail = jest.fn();

  beforeEach(() => {
    sendMail.mockReset();
    jest.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as any);
  });

  it('sends email verification as a clickable HTML link', async () => {
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          SMTP_HOST: 'smtp.example.test',
          MAIL_FROM: 'Lyra <no-reply@example.test>',
        };
        return values[key];
      }),
    } as unknown as ConfigService;
    const mailer = new MailerService(config);

    await mailer.sendEmailVerification(
      'ann@example.test',
      'https://dev.getlyras.app/auth/verify-email?token=abc',
    );

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ann@example.test',
        subject: 'Confirm your Lyra email',
        text: expect.stringContaining(
          'https://dev.getlyras.app/auth/verify-email?token=abc',
        ),
        html: expect.stringContaining(
          '<a href="https://dev.getlyras.app/auth/verify-email?token=abc">Confirm email</a>',
        ),
      }),
    );
  });
});

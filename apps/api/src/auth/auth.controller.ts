import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SignupBody } from './dto/signup.dto';
import { LoginBody } from './dto/login.dto';
import {
  ChangePasswordBody,
  ForgotPasswordBody,
  ResetPasswordBody,
} from './dto/security.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@lyra/shared';

const REFRESH_COOKIE = 'rt';
// Scoped to /auth so the cookie reaches both /auth/refresh and /auth/logout.
const COOKIE_PATH = '/auth';
const REFRESH_MAX_AGE = 1000 * 60 * 60 * 24 * 30; // 30 days

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: COOKIE_PATH,
      maxAge: REFRESH_MAX_AGE,
    });
  }

  @Public()
  @Post('signup')
  async signup(
    @Body() body: SignupBody,
  ) {
    return this.auth.signup(body.email, body.password, body.name);
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() body: LoginBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { auth, refreshToken } = await this.auth.login(
      body.email,
      body.password,
    );
    this.setRefreshCookie(res, refreshToken);
    return auth;
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    const { accessToken, refreshToken } = await this.auth.refresh(raw);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  @HttpCode(204)
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined);
    res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
  }

  @Get('me')
  me(@CurrentUser() user: User) {
    return { user };
  }

  // Re-send the email-verification link to the signed-in (unverified) user.
  @Post('resend-verification')
  @HttpCode(200)
  resendVerification(@CurrentUser() user: User) {
    return this.auth.resendVerification(user.id);
  }

  private webOrigin(): string {
    return this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173';
  }

  private renderVerifyEmailPage(
    statusCode: 200 | 400,
    title: string,
    message: string,
    actionLabel: string,
    actionHref: string,
    res: Response,
  ) {
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f7f8; color: #18181b; }
      main { width: min(380px, calc(100vw - 32px)); padding: 28px; border: 1px solid #dedee3; border-radius: 14px; background: #fff; box-shadow: 0 12px 36px rgba(0, 0, 0, 0.08); text-align: center; }
      .mark { width: 42px; height: 42px; margin: 0 auto 16px; border-radius: 999px; display: grid; place-items: center; background: ${statusCode === 200 ? '#ff6b1a' : '#f1c9c9'}; color: #fff; font-weight: 700; }
      h1 { margin: 0 0 8px; font-size: 22px; line-height: 1.2; }
      p { margin: 0 0 20px; color: #66666f; line-height: 1.5; }
      a { display: inline-flex; min-height: 36px; align-items: center; justify-content: center; padding: 0 14px; border-radius: 8px; background: #ff6b1a; color: #fff; text-decoration: none; font-size: 14px; font-weight: 600; }
      @media (prefers-color-scheme: dark) {
        body { background: #09090b; color: #f4f4f5; }
        main { background: #18181b; border-color: #303038; box-shadow: none; }
        p { color: #a1a1aa; }
      }
    </style>
  </head>
  <body>
    <main>
      <div class="mark">${statusCode === 200 ? 'OK' : '!'}</div>
      <h1>${title}</h1>
      <p>${message}</p>
      <a href="${actionHref}">${actionLabel}</a>
    </main>
  </body>
</html>`;
    return res.status(statusCode).type('html').send(html);
  }

  // Google sign-in (redirect flow). Sets a short-lived CSRF `state` cookie, then
  // sends the browser to Google's consent screen.
  @Public()
  @Get('google')
  googleStart(@Res() res: Response) {
    const web = this.webOrigin();
    if (!this.auth.googleConfigured()) {
      return res.redirect(`${web}/login?error=google_unavailable`);
    }
    const state = randomBytes(16).toString('hex');
    res.cookie('g_state', state, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax', // must survive Google's top-level redirect back
      path: COOKIE_PATH,
      maxAge: 10 * 60 * 1000,
    });
    return res.redirect(this.auth.googleAuthUrl(state));
  }

  // Google redirects back here with ?code&state. Validate state, exchange the
  // code, set the session cookie, and bounce to the app (which restores the
  // session via /auth/refresh).
  @Public()
  @Get('google/callback')
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
  ) {
    const web = this.webOrigin();
    const saved = req.cookies?.g_state as string | undefined;
    res.clearCookie('g_state', { path: COOKIE_PATH });
    if (!code || !state || !saved || state !== saved) {
      return res.redirect(`${web}/login?error=google`);
    }
    try {
      const { refreshToken } = await this.auth.loginWithGoogle(code);
      this.setRefreshCookie(res, refreshToken);
      return res.redirect(`${web}/`);
    } catch {
      return res.redirect(`${web}/login?error=google`);
    }
  }

  // Authenticated: verify current password, set the new one, rotate sessions.
  @HttpCode(200)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: User,
    @Body() body: ChangePasswordBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { auth, refreshToken } = await this.auth.changePassword(
      user.id,
      body.currentPassword,
      body.newPassword,
    );
    this.setRefreshCookie(res, refreshToken);
    return auth;
  }

  // Public: always 200 (never reveal whether the email exists).
  @Public()
  @HttpCode(200)
  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordBody) {
    await this.auth.forgotPassword(body.email);
    return { ok: true };
  }

  @Public()
  @HttpCode(200)
  @Post('reset-password')
  async resetPassword(@Body() body: ResetPasswordBody) {
    await this.auth.resetPassword(body.token, body.newPassword);
    return { ok: true };
  }

  @Public()
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string | undefined, @Res() res: Response) {
    const web = this.webOrigin();
    if (!token) {
      return this.renderVerifyEmailPage(
        400,
        'Confirmation link expired',
        'This confirmation link is invalid or has expired. Please create an account again or request a fresh link.',
        'Back to sign in',
        `${web}/login`,
        res,
      );
    }
    try {
      await this.auth.verifyEmail(token);
      return this.renderVerifyEmailPage(
        200,
        'Your account is verified',
        'Your Lyra account has been confirmed. You can now sign in and start using your workspace.',
        'Sign in',
        `${web}/login`,
        res,
      );
    } catch {
      return this.renderVerifyEmailPage(
        400,
        'Confirmation link expired',
        'This confirmation link is invalid or has expired. Please create an account again or request a fresh link.',
        'Back to sign in',
        `${web}/login`,
        res,
      );
    }
  }
}

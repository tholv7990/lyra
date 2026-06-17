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
    @Res({ passthrough: true }) res: Response,
  ) {
    const { auth, refreshToken } = await this.auth.signup(
      body.email,
      body.password,
      body.name,
    );
    this.setRefreshCookie(res, refreshToken);
    return auth;
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

  private webOrigin(): string {
    return this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173';
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
}

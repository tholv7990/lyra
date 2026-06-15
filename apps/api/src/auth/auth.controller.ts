import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SignupBody } from './dto/signup.dto';
import { LoginBody } from './dto/login.dto';
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
}

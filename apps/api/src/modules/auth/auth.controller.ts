import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthedRequest, AuthUser, CurrentUser, Public, RateLimit } from '../../common/auth.decorators';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, VerifyEmailDto } from '../../common/dtos';
import { RealtimeService } from '../realtime/realtime.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
    private readonly realtime: RealtimeService,
  ) {}

  @Public()
  @RateLimit({ name: 'register', limit: 10, windowSeconds: 3600 })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    await this.auth.register(dto);
    return { message: 'Check your email to verify your account.' };
  }

  @Public()
  @RateLimit({ name: 'login', limit: 20, windowSeconds: 300 })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.login(dto.email, dto.password);
    await this.sessions.create(user.id, req.headers['user-agent'], res);
    return this.users.me(user);
  }

  @HttpCode(200)
  @Post('logout')
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    await this.sessions.revoke(req.sessionId!, res);
    this.realtime.disconnectSession(req.sessionId!);
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.me(user);
  }

  @Public()
  @RateLimit({ name: 'verify', limit: 20, windowSeconds: 600 })
  @HttpCode(200)
  @Post('verify-email')
  async verify(@Body() dto: VerifyEmailDto) {
    await this.auth.verifyEmail(dto.token);
    return { ok: true };
  }

  @RateLimit({ name: 'resend', limit: 5, windowSeconds: 3600, by: 'user' })
  @HttpCode(200)
  @Post('resend-verification')
  async resend(@CurrentUser() user: AuthUser) {
    await this.auth.resendVerification(user);
    return { ok: true };
  }

  @Public()
  @RateLimit({ name: 'forgot', limit: 5, windowSeconds: 900 })
  @HttpCode(200)
  @Post('forgot-password')
  async forgot(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
    return { message: 'If that email has an account, a reset link is on its way.' };
  }

  @Public()
  @RateLimit({ name: 'reset', limit: 10, windowSeconds: 900 })
  @HttpCode(200)
  @Post('reset-password')
  async reset(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.password);
    return { ok: true };
  }

  @RateLimit({ name: 'change-password', limit: 10, windowSeconds: 900, by: 'user' })
  @HttpCode(200)
  @Post('change-password')
  async changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: AuthUser, @Req() req: AuthedRequest) {
    await this.auth.changePassword(user, req.sessionId!, dto.currentPassword, dto.newPassword);
    return { ok: true };
  }
}

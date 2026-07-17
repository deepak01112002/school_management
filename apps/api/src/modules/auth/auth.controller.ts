import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Verify2faDto } from './dto/enable-2fa.dto';

import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Login ───────────────────────────────────────────────────────────────────

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email + password (+ optional TOTP)' })
  @ApiResponse({ status: 200, description: 'Returns access token or 2FA challenge' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(dto, req, res);
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────────

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using httpOnly cookie' })
  @ApiResponse({ status: 200, description: 'New access token issued' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.refresh(req, res);
  }

  // ─── Logout ───────────────────────────────────────────────────────────────────

  @Post('logout')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  async logout(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.logout(user.id, req, res);
  }

  // ─── Forgot Password ──────────────────────────────────────────────────────────

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset OTP' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @TenantId() tenantId?: string,
  ) {
    return this.authService.forgotPassword(dto, tenantId);
  }

  // ─── Reset Password ───────────────────────────────────────────────────────────

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using OTP' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ─── Verify Email ─────────────────────────────────────────────────────────────

  @Public()
  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email address via token' })
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  // ─── Me ───────────────────────────────────────────────────────────────────────

  @Get('me')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get current authenticated user' })
  async getMe(@CurrentUser() user: AuthUser) {
    return user;
  }

  // ─── 2FA ─────────────────────────────────────────────────────────────────────

  @Post('2fa/enable')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Generate 2FA secret and QR code URI' })
  async enable2fa(@CurrentUser() user: AuthUser) {
    return this.authService.enable2fa(user.id);
  }

  @Post('2fa/verify')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Verify TOTP code and activate 2FA' })
  async verify2fa(
    @CurrentUser() user: AuthUser,
    @Body() dto: Verify2faDto,
  ) {
    return this.authService.verify2fa(user.id, dto.code);
  }

  @Post('2fa/disable')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Disable 2FA after verifying current TOTP code' })
  async disable2fa(
    @CurrentUser() user: AuthUser,
    @Body() dto: Verify2faDto,
  ) {
    return this.authService.disable2fa(user.id, dto.code);
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────────

  @Get('sessions')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List active sessions for current user' })
  async getSessions(@CurrentUser() user: AuthUser) {
    return this.authService.getSessions(user.id);
  }

  @Delete('sessions/:id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Revoke a specific session' })
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @Param('id') sessionId: string,
  ) {
    return this.authService.revokeSession(user.id, sessionId);
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';
import { Request, Response } from 'express';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const COOKIE_NAME = 'refreshToken';
const REFRESH_TOKEN_TTL_DAYS = 7;
const ACCESS_TOKEN_EXPIRES_IN = 900; // 15 minutes in seconds
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;
const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ─── Login ───────────────────────────────────────────────────────────────────

  async login(
    dto: LoginDto,
    req: Request,
    res: Response,
  ): Promise<
    | { requiresTwoFactor: true }
    | { accessToken: string; expiresIn: number; user: object }
  > {
    const tenantId = this.getTenantId(req);

    // Find user by email in the tenant (or platform-level if tenantId is null)
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        tenantId: tenantId ?? null,
        deletedAt: null,
      },
      include: {
        role: { select: { id: true, name: true, permissions: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account lock
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account is locked. Check your email.');
    }

    // Verify password
    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordValid) {
      const newCount = user.failedLoginCount + 1;
      const updateData: Record<string, unknown> = { failedLoginCount: newCount };

      if (newCount >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = new Date(
          Date.now() + LOCK_DURATION_MINUTES * 60 * 1000,
        );
        updateData['lockedUntil'] = lockedUntil;
        this.logger.debug(
          `Account locked for user ${user.id} until ${lockedUntil.toISOString()}`,
        );
        // TODO: dispatch unlock email via queue when email provider is wired
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed count and update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lastLoginAt: new Date(), lockedUntil: null },
    });

    // Email must be verified
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Email not verified');
    }

    // 2FA check
    if (user.twoFactorEnabled) {
      if (!dto.totpCode) {
        return { requiresTwoFactor: true };
      }

      const valid = speakeasy.totp.verify({
        secret: user.twoFactorSecret!,
        encoding: 'base32',
        token: dto.totpCode,
        window: 1,
      });

      if (!valid) {
        throw new UnauthorizedException('Invalid two-factor code');
      }
    }

    // Issue tokens
    const { accessToken, refreshToken, refreshTokenHash } =
      await this.generateTokens(user.id, user.email, user.tenantId, user.role.name);

    // Detect new device
    const userAgent = req.headers['user-agent'] ?? 'unknown';
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ??
      req.socket?.remoteAddress ??
      'unknown';

    const existingSessions = await this.prisma.session.findMany({
      where: { userId: user.id, revokedAt: null },
      select: { deviceInfo: true },
    });

    const isNewDevice = !existingSessions.some((s) => {
      const info = s.deviceInfo as { userAgent?: string } | null;
      return info?.userAgent === userAgent;
    });

    if (isNewDevice) {
      this.logger.debug(`New device login for user ${user.id}`);
    }

    // Save session
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.session.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        refreshTokenHash,
        deviceInfo: { userAgent, isNewDevice },
        ipAddress,
        expiresAt,
      },
    });

    // Set cookie
    this.setRefreshCookie(res, refreshToken);

    // Audit log
    await this.auditLog.log({
      tenantId: user.tenantId ?? undefined,
      userId: user.id,
      action: 'auth.login',
      entity: 'User',
      entityId: user.id,
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantId: user.tenantId,
        role: user.role.name,
        permissions: user.role.permissions as string[],
      },
    };
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────────

  async refresh(
    req: Request,
    res: Response,
  ): Promise<{ accessToken: string; expiresIn: number; user: object }> {
    const rawToken = req.cookies?.[COOKIE_NAME] as string | undefined;

    if (!rawToken) {
      throw new UnauthorizedException('No refresh token');
    }

    const now = new Date();

    // Find candidate sessions (not revoked, not expired) — we'll iterate to find the match
    // We need userId from the token itself first. Since we can't do that without storing
    // something, we search by a partial index. Store the first 16 chars as a lookup hint.
    const hint = rawToken.substring(0, 16);

    // Fallback: search all active sessions and compare — fine for now
    const sessions = await this.prisma.session.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: now },
      },
      include: {
        user: {
          include: { role: { select: { id: true, name: true, permissions: true } } },
        },
      },
    });

    let matchedSession: (typeof sessions)[0] | null = null;

    for (const session of sessions) {
      const match = await bcrypt.compare(rawToken, session.refreshTokenHash);
      if (match) {
        matchedSession = session;
        break;
      }
    }

    if (!matchedSession) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const { user } = matchedSession;

    // Revoke old session
    await this.prisma.session.update({
      where: { id: matchedSession.id },
      data: { revokedAt: now },
    });

    // Issue new tokens
    const { accessToken, refreshToken, refreshTokenHash } =
      await this.generateTokens(
        user.id,
        user.email,
        user.tenantId,
        user.role.name,
      );

    const userAgent = req.headers['user-agent'] ?? 'unknown';
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ??
      req.socket?.remoteAddress ??
      'unknown';

    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.session.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        refreshTokenHash,
        deviceInfo: { userAgent },
        ipAddress,
        expiresAt,
      },
    });

    this.setRefreshCookie(res, refreshToken);

    return {
      accessToken,
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      user: this.toAuthUserPayload(user),
    };
  }

  // ─── Logout ───────────────────────────────────────────────────────────────────

  async logout(userId: string, req: Request, res: Response): Promise<{ message: string }> {
    const rawToken = req.cookies?.[COOKIE_NAME] as string | undefined;

    if (rawToken) {
      const sessions = await this.prisma.session.findMany({
        where: { userId, revokedAt: null },
      });

      for (const session of sessions) {
        const match = await bcrypt.compare(rawToken, session.refreshTokenHash);
        if (match) {
          await this.prisma.session.update({
            where: { id: session.id },
            data: { revokedAt: new Date() },
          });
          break;
        }
      }
    }

    this.clearRefreshCookie(res);

    const userAgent = req.headers['user-agent'] ?? 'unknown';
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ??
      req.socket?.remoteAddress ??
      'unknown';

    await this.auditLog.log({
      userId,
      action: 'auth.logout',
      entity: 'User',
      entityId: userId,
      ipAddress,
      userAgent,
    });

    return { message: 'Logged out successfully' };
  }

  // ─── Forgot Password ──────────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto, tenantId?: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        tenantId: tenantId ?? null,
        deletedAt: null,
      },
    });

    // Always return the same message to avoid leaking user existence
    const response = { message: 'If email exists, OTP has been sent' };

    if (!user) {
      return response;
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // Store hashed OTP and expiry in dedicated columns
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        otpHash,
        otpExpiresAt: otpExpiry,
      },
    });

    // TODO: send email via queue when email provider is wired
    this.logger.debug(
      `Password reset OTP for user ${user.id} (${user.email}): ${otp}`,
    );

    return response;
  }

  // ─── Reset Password ───────────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });

    if (!user) {
      throw new BadRequestException('OTP expired or invalid');
    }

    if (!user.otpHash || !user.otpExpiresAt) {
      throw new BadRequestException('OTP expired or invalid');
    }

    if (user.otpExpiresAt < new Date()) {
      throw new BadRequestException('OTP expired or invalid');
    }

    const otpValid = await bcrypt.compare(dto.otp, user.otpHash);
    if (!otpValid) {
      throw new BadRequestException('OTP expired or invalid');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    // Clear OTP fields and update password
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date(),
        otpHash: null,
        otpExpiresAt: null,
      },
    });

    await this.auditLog.log({
      userId: user.id,
      action: 'auth.resetPassword',
      entity: 'User',
      entityId: user.id,
    });

    return { message: 'Password reset successfully' };
  }

  // ─── Verify Email ─────────────────────────────────────────────────────────────

  async verifyEmail(token: string): Promise<{ message: string }> {
    let userId: string;
    let timestamp: number;

    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8');
      const parts = decoded.split(':');
      if (parts.length !== 2) throw new Error('Invalid format');
      userId = parts[0];
      timestamp = parseInt(parts[1], 10);
    } catch {
      throw new BadRequestException('Invalid verification token');
    }

    // Token must be less than 24 hours old
    const age = Date.now() - timestamp;
    if (age > 24 * 60 * 60 * 1000) {
      throw new BadRequestException('Verification token has expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (!user.emailVerifiedAt) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
      });
    }

    return { message: 'Email verified successfully' };
  }

  // ─── 2FA ─────────────────────────────────────────────────────────────────────

  async enable2fa(userId: string): Promise<{ otpAuthUrl: string; secret: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const secret = speakeasy.generateSecret({
      name: `SchoolERP (${user.email})`,
      length: 20,
    });

    // Store base32 secret (not yet enabled — user must verify first)
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret.base32 },
    });

    return {
      otpAuthUrl: secret.otpauth_url ?? '',
      secret: secret.base32,
    };
  }

  async verify2fa(userId: string, code: string): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true },
    });

    if (!user?.twoFactorSecret) {
      throw new BadRequestException('2FA not initialized. Call enable first.');
    }

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!valid) {
      throw new UnauthorizedException('Invalid two-factor code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    return { success: true };
  }

  async disable2fa(userId: string, code: string): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });

    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('2FA is not enabled');
    }

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!valid) {
      throw new UnauthorizedException('Invalid two-factor code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    return { success: true };
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────────

  async getSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(userId: string, sessionId: string): Promise<{ message: string }> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    return { message: 'Session revoked' };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  generateEmailVerificationToken(userId: string): string {
    const payload = `${userId}:${Date.now()}`;
    return Buffer.from(payload).toString('base64');
  }

  private async generateTokens(
    userId: string,
    email: string,
    tenantId: string | null,
    roleName: string,
  ) {
    const payload = {
      sub: userId,
      email,
      tenantId,
      role: roleName,
    };

    const accessToken = this.jwtService.sign(payload);

    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = await bcrypt.hash(rawRefreshToken, BCRYPT_ROUNDS);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      refreshTokenHash,
    };
  }

  private toAuthUserPayload(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    tenantId: string | null;
    role: { name: string; permissions: unknown };
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tenantId: user.tenantId,
      role: user.role.name,
      permissions: user.role.permissions as string[],
    };
  }

  private getTenantId(req: Request): string | null {
    const ctx = req['tenantContext'] as
      | { tenantId: string }
      | null
      | undefined;
    return ctx?.tenantId ?? null;
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }
}

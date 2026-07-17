import { IsOptional, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  notifications?: {
    smsEnabled?: boolean;
    emailEnabled?: boolean;
    whatsappEnabled?: boolean;
    smsProvider?: string;
    smsAuthKey?: string;
    whatsappToken?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
  };

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  payments?: {
    razorpayEnabled?: boolean;
    razorpayKeyId?: string;
    razorpayKeySecret?: string;
    stripeEnabled?: boolean;
    stripePublishableKey?: string;
    stripeSecretKey?: string;
  };

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  security?: {
    allowedIps?: string[];
    passwordMinLength?: number;
    passwordRequireUppercase?: boolean;
    passwordRequireDigit?: boolean;
    passwordRequireSpecial?: boolean;
    sessionTimeoutMinutes?: number;
  };
}

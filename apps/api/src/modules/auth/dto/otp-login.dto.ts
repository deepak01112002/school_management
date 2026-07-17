import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestOtpLoginDto {
  @ApiProperty({ example: 'user@demo.school-erp.com' })
  @IsEmail()
  email: string;
}

export class VerifyOtpLoginDto {
  @ApiProperty({ example: 'user@demo.school-erp.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  otp: string;
}

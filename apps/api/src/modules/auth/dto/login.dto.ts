import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'owner@demo.school-erp.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Owner@123456' })
  @IsString()
  @MinLength(1)
  password: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  totpCode?: string;
}

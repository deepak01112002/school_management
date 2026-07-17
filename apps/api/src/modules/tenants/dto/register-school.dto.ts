import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterSchoolDto {
  @ApiProperty({ example: 'greenwood' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Subdomain must be lowercase alphanumeric with dashes',
  })
  @MinLength(3)
  @MaxLength(50)
  subdomain: string;

  @ApiProperty({ example: 'Greenwood International School' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  schoolName: string;

  @ApiProperty({ example: 'Asha' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  ownerFirstName: string;

  @ApiProperty({ example: 'Sharma' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  ownerLastName: string;

  @ApiProperty({ example: 'owner@greenwood.edu' })
  @IsEmail()
  ownerEmail: string;

  @ApiPropertyOptional({ example: '+91 9876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'MG Road, Bengaluru' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Selected subscription plan ID' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiProperty({ example: 'Owner@123456' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Password must contain uppercase, digit, and special character',
  })
  password: string;
}

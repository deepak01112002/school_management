import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateTenantDto {
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
  name: string;

  @ApiPropertyOptional({ example: 'info@greenwood.edu' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'ID of the subscription plan to assign' })
  @IsOptional()
  @IsString()
  planId?: string;
}

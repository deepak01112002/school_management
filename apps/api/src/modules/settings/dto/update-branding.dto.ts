import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBrandingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: '#4F46E5', description: 'CSS hex color' })
  @IsOptional()
  @Matches(/^#([0-9A-Fa-f]{6})$/, { message: 'Must be a valid hex color like #4F46E5' })
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#818CF8' })
  @IsOptional()
  @Matches(/^#([0-9A-Fa-f]{6})$/)
  secondaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SubjectType } from '@prisma/client';

export class CreateSubjectDto {
  @ApiProperty({ example: 'Mathematics' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'MATH-01' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code: string;

  @ApiPropertyOptional({ enum: SubjectType, default: SubjectType.CORE })
  @IsOptional()
  @IsEnum(SubjectType)
  type?: SubjectType;

  @ApiPropertyOptional({ example: 'Core mathematics for all classes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

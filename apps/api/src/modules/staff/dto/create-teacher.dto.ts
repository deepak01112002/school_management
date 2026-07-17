import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EmploymentType, Gender } from '@prisma/client';

export class CreateTeacherDto {
  @ApiProperty({ example: 'T-001' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  employeeCode: string;

  @ApiProperty({ example: 'Anita' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName: string;

  @ApiProperty({ example: 'Sharma' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName: string;

  @ApiProperty({ example: 'anita.teacher@school.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Teacher@123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: '2026-07-06' })
  @IsDateString()
  joiningDate: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;
}

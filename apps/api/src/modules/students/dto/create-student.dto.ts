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
import { Gender } from '@prisma/client';

export class CreateStudentDto {
  @ApiProperty({ example: 'ADM-001' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  admissionNo: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  rollNo?: string;

  @ApiProperty({ example: 'Riya' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName: string;

  @ApiProperty({ example: 'Patel' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName: string;

  @ApiProperty({ example: 'riya.student@school.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Student@123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: '2017-08-12' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ enum: Gender })
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({ example: '2026-07-06' })
  @IsDateString()
  admissionDate: string;

  @ApiProperty({ example: 'clxclassid' })
  @IsString()
  classId: string;

  @ApiProperty({ example: 'clxsectionid' })
  @IsString()
  sectionId: string;

  @ApiProperty({ example: 'clxacademicyearid' })
  @IsString()
  academicYearId: string;
}

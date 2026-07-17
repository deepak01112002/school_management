import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AssignSubjectDto {
  @ApiProperty({ example: 'classId-cuid' })
  @IsString()
  classId: string;

  @ApiProperty({ example: 'subjectId-cuid' })
  @IsString()
  subjectId: string;

  @ApiPropertyOptional({ example: 'staffId-cuid' })
  @IsOptional()
  @IsString()
  teacherId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isElective?: boolean;
}

export class UpdateClassSubjectDto {
  @ApiPropertyOptional({ example: 'staffId-cuid' })
  @IsOptional()
  @IsString()
  teacherId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isElective?: boolean;
}

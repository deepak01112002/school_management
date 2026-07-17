import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewStudentLeaveDto {
  @ApiPropertyOptional({ example: 'Approved after parent confirmation.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

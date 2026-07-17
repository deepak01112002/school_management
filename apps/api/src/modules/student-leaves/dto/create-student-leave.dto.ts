import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateStudentLeaveDto {
  @ApiProperty({ example: '2026-07-10' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-07-11' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 'Fever and doctor advised rest.' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

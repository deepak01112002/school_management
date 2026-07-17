import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAcademicYearDto {
  @ApiProperty({ example: '2026-27' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  name: string;

  @ApiProperty({ example: '2026-04-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2027-03-31' })
  @IsDateString()
  endDate: string;
}

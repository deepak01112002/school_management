import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle } from '@prisma/client';

export class CreateSubscriptionPlanDto {
  @ApiProperty({ example: 'Basic Plan' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 999 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ enum: BillingCycle, example: BillingCycle.MONTHLY })
  @IsEnum(BillingCycle)
  billingCycle: BillingCycle;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(1)
  studentLimit: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  staffLimit?: number;

  @ApiPropertyOptional({ example: ['attendance', 'fee_management'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];
}

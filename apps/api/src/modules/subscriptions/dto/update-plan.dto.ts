import { PartialType } from '@nestjs/swagger';
import { CreateSubscriptionPlanDto } from './create-plan.dto';

export class UpdateSubscriptionPlanDto extends PartialType(CreateSubscriptionPlanDto) {}

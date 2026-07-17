import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateSubscriptionPlanDto } from './dto/create-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-plan.dto';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Plans (Super Admin) ─────────────────────────────────────────────────────

  async findAllPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
      include: {
        _count: { select: { subscriptions: true } },
      },
    });
  }

  async findOnePlan(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException(`Plan "${id}" not found`);
    return plan;
  }

  async createPlan(dto: CreateSubscriptionPlanDto) {
    const exists = await this.prisma.subscriptionPlan.findUnique({
      where: { name: dto.name },
    });
    if (exists) throw new ConflictException(`Plan "${dto.name}" already exists`);

    return this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        price: dto.price,
        billingCycle: dto.billingCycle,
        studentLimit: dto.studentLimit,
        staffLimit: dto.staffLimit,
        features: dto.features ?? [],
        isActive: true,
      },
    });
  }

  async updatePlan(id: string, dto: UpdateSubscriptionPlanDto) {
    await this.findOnePlan(id);
    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.billingCycle !== undefined && { billingCycle: dto.billingCycle }),
        ...(dto.studentLimit !== undefined && { studentLimit: dto.studentLimit }),
        ...(dto.staffLimit !== undefined && { staffLimit: dto.staffLimit }),
        ...(dto.features !== undefined && { features: dto.features }),
      },
    });
  }

  async togglePlan(id: string, isActive: boolean) {
    await this.findOnePlan(id);
    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive },
    });
  }

  async getTenantsOnPlan(planId: string) {
    return this.prisma.subscription.count({ where: { planId } });
  }

  // ─── Tenant Subscription ─────────────────────────────────────────────────────

  async getTenantSubscription(tenantId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
    if (!subscription) throw new NotFoundException('No subscription found');
    return subscription;
  }
}

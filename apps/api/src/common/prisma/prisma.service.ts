import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Models that should NOT be filtered by tenantId
const TENANT_EXEMPT_MODELS = ['tenant', 'subscriptionplan', 'permission'];

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  withTenant(tenantId: string) {
    return this.$extends({
      query: {
        $allModels: {
          async findMany({ model, operation, args, query }) {
            if (!TENANT_EXEMPT_MODELS.includes(model.toLowerCase())) {
              const typedArgs = args as { where?: Record<string, unknown> };
              typedArgs.where = { ...typedArgs.where, tenantId };
            }
            return query(args);
          },

          async findFirst({ model, operation, args, query }) {
            if (!TENANT_EXEMPT_MODELS.includes(model.toLowerCase())) {
              const typedArgs = args as { where?: Record<string, unknown> };
              typedArgs.where = { ...typedArgs.where, tenantId };
            }
            return query(args);
          },

          async findUnique({ model, operation, args, query }) {
            if (!TENANT_EXEMPT_MODELS.includes(model.toLowerCase())) {
              const typedArgs = args as { where?: Record<string, unknown> };
              typedArgs.where = { ...typedArgs.where, tenantId };
            }
            return query(args);
          },

          async count({ model, operation, args, query }) {
            if (!TENANT_EXEMPT_MODELS.includes(model.toLowerCase())) {
              const typedArgs = args as { where?: Record<string, unknown> };
              typedArgs.where = { ...typedArgs.where, tenantId };
            }
            return query(args);
          },

          async aggregate({ model, operation, args, query }) {
            if (!TENANT_EXEMPT_MODELS.includes(model.toLowerCase())) {
              const typedArgs = args as { where?: Record<string, unknown> };
              typedArgs.where = { ...typedArgs.where, tenantId };
            }
            return query(args);
          },

          async groupBy({ model, operation, args, query }) {
            if (!TENANT_EXEMPT_MODELS.includes(model.toLowerCase())) {
              const typedArgs = args as { where?: Record<string, unknown> };
              typedArgs.where = { ...typedArgs.where, tenantId };
            }
            return query(args);
          },

          async create({ model, operation, args, query }) {
            if (!TENANT_EXEMPT_MODELS.includes(model.toLowerCase())) {
              const typedArgs = args as { data: Record<string, unknown> };
              typedArgs.data = { ...typedArgs.data, tenantId };
            }
            return query(args);
          },

          async update({ model, operation, args, query }) {
            if (!TENANT_EXEMPT_MODELS.includes(model.toLowerCase())) {
              const typedArgs = args as { where?: Record<string, unknown> };
              typedArgs.where = { ...typedArgs.where, tenantId };
            }
            return query(args);
          },

          async updateMany({ model, operation, args, query }) {
            if (!TENANT_EXEMPT_MODELS.includes(model.toLowerCase())) {
              const typedArgs = args as { where?: Record<string, unknown> };
              typedArgs.where = { ...typedArgs.where, tenantId };
            }
            return query(args);
          },

          async delete({ model, operation, args, query }) {
            if (!TENANT_EXEMPT_MODELS.includes(model.toLowerCase())) {
              const typedArgs = args as { where?: Record<string, unknown> };
              typedArgs.where = { ...typedArgs.where, tenantId };
            }
            return query(args);
          },

          async deleteMany({ model, operation, args, query }) {
            if (!TENANT_EXEMPT_MODELS.includes(model.toLowerCase())) {
              const typedArgs = args as { where?: Record<string, unknown> };
              typedArgs.where = { ...typedArgs.where, tenantId };
            }
            return query(args);
          },
        },
      },
    });
  }
}

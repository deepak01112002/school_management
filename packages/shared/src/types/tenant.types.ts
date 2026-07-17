export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  subscriptionPlan: SubscriptionPlan;
  isActive: boolean;
  features: string[];
}

export enum SubscriptionPlan {
  FREE = 'FREE',
  BASIC = 'BASIC',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

export interface TenantSettings {
  tenantId: string;
  academicYearStart: number; // month (1-12)
  timezone: string;
  currency: string;
  currencySymbol: string;
  dateFormat: string;
  logoUrl?: string;
  primaryColor?: string;
  allowParentPortal: boolean;
  allowStudentPortal: boolean;
  maxStudents: number;
  maxStaff: number;
}

/**
 * Tenant-related types and interfaces
 */

export interface TenantContext {
  tenantId: string;
  userId?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  household_id: string;
  role: string;
}

export const TENANT_CONTEXT_KEY = 'TENANT_CONTEXT';
export const AUTH_USER_KEY = 'AUTH_USER';

export const AUTH_HEADERS = {
  TENANT_ID: 'x-tenant-id',
  USER_ID: 'x-user-id',
} as const;
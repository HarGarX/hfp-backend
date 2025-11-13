/**
 * Authentication Placeholder for Sprint 1
 * 
 * This module provides placeholder interfaces and types for authentication
 * until Keycloak integration is implemented in Phase 2.
 * 
 * For Sprint 1, authentication is handled via headers:
 * - x-tenant-id: identifies the tenant/household context
 * - X-User-Id: identifies the authenticated user (for auditing)
 */

// Auth Module - Phase 1 Implementation
export { AuthModule } from './auth.module';

// Guards
export { AuthGuard } from './guards/auth.guard';
export { RolesGuard, UserRole } from './guards/roles.guard';

// Decorators
export {
  Public,
  RequireRoles,
  RequireAuth,
  RequireHouseholdAdmin,
  RequireHouseholdMember,
  RequireSystemAdmin,
  RequireAnyRole,
} from './decorators/auth.decorators';

// Middleware
export { RequestValidationMiddleware } from './middleware/request-validation.middleware';
export { RateLimitMiddleware } from './middleware/rate-limit.middleware';

// Legacy interfaces for backward compatibility
export interface AuthUser {
  id: string;
  email: string;
  role: string;
  household_id: string;
}

export interface TenantContext {
  tenantId: string;
  userId?: string;
}

export const AUTH_HEADERS = {
  TENANT_ID: 'x-tenant-id',
  USER_ID: 'x-user-id',
} as const;

export type AuthHeaders = typeof AUTH_HEADERS;
import { Injectable, Scope } from '@nestjs/common';
import { TenantContext } from '../tenant.types';

/**
 * Service for managing tenant context within request scope
 * Uses REQUEST scope to ensure isolation between concurrent requests
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  private tenantContext: TenantContext | null = null;

  /**
   * Set the tenant context for the current request
   */
  setTenantContext(context: TenantContext): void {
    this.tenantContext = context;
  }

  /**
   * Get the current tenant context
   */
  getTenantContext(): TenantContext | null {
    return this.tenantContext;
  }

  /**
   * Get the current tenant ID
   */
  getTenantId(): string | null {
    return this.tenantContext?.tenantId || null;
  }

  /**
   * Get the current user ID
   */
  getUserId(): string | null {
    return this.tenantContext?.userId || null;
  }

  /**
   * Check if tenant context is set
   */
  hasTenantContext(): boolean {
    return this.tenantContext !== null && this.tenantContext.tenantId !== undefined;
  }

  /**
   * Ensure tenant context is available, throw error if not
   */
  requireTenantContext(): TenantContext {
    if (!this.tenantContext || !this.tenantContext.tenantId) {
      throw new Error('Tenant context is required but not available');
    }
    return this.tenantContext;
  }
}
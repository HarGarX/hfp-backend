import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for household-scoped endpoints
 */
export const HOUSEHOLD_SCOPED_KEY = 'household_scoped';

/**
 * Decorator to mark endpoints that require household context
 * This decorator sets metadata that can be used by guards and interceptors
 * to enforce tenant isolation
 */
export const HouseholdScoped = (required: boolean = true) => SetMetadata(HOUSEHOLD_SCOPED_KEY, required);

/**
 * Guard that enforces household scope requirements
 */
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContextService } from '../services/tenant-context.service';

@Injectable()
export class HouseholdScopeGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private tenantContextService: TenantContextService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isHouseholdScoped = this.reflector.get<boolean>(
      HOUSEHOLD_SCOPED_KEY,
      context.getHandler(),
    );

    // If endpoint is not marked as household scoped, allow access
    if (isHouseholdScoped === undefined || isHouseholdScoped === false) {
      return true;
    }

    // Check if tenant context is available
    if (!this.tenantContextService.hasTenantContext()) {
      throw new ForbiddenException('This endpoint requires household context (x-tenant-id header)');
    }

    const tenantId = this.tenantContextService.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException('Valid household ID is required');
    }

    return true;
  }
}
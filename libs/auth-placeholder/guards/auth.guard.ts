import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContextService } from '../../tenant';
import { TenantContext } from '../../tenant/tenant.types';

/**
 * Basic authentication guard that validates request headers for Phase 1
 * Phase 2 will replace this with proper Keycloak JWT validation
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private tenantContext: TenantContextService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // Check if route is marked as public (only if reflector is available)
    let isPublic = false;
    if (this.reflector) {
      isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
        context.getHandler(),
        context.getClass(),
      ]);
    }
    
    if (isPublic) {
      return true;
    }

    // Validate required headers for Phase 1
    const tenantId = request.headers['x-tenant-id'];
    const userId = request.headers['x-user-id'];

    if (!tenantId) {
      throw new UnauthorizedException('Missing x-tenant-id header');
    }

    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      throw new UnauthorizedException('Invalid x-tenant-id format');
    }

    if (userId && !uuidRegex.test(userId)) {
      throw new UnauthorizedException('Invalid x-user-id format');
    }

    // Set tenant context for downstream services
    const tenantContext: TenantContext = {
      tenantId,
      userId: userId || undefined,
    };
    if (this.tenantContext) {
      this.tenantContext.setTenantContext(tenantContext);
    }

    // Add authenticated user info to request object
    request.user = {
      tenantId,
      userId,
      // Phase 1: Basic role assignment (will be replaced with JWT claims in Phase 2)
      roles: userId ? ['household_member'] : ['system'],
    };

    return true;
  }
}
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Available roles in the system
 */
export enum UserRole {
  ADMIN = 'admin',
  HOUSEHOLD_ADMIN = 'household_admin', 
  HOUSEHOLD_MEMBER = 'household_member',
  HOUSEHOLD_VIEWER = 'household_viewer',
}

/**
 * Role hierarchy - higher roles include permissions of lower roles
 */
const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  [UserRole.ADMIN]: [UserRole.ADMIN, UserRole.HOUSEHOLD_ADMIN, UserRole.HOUSEHOLD_MEMBER, UserRole.HOUSEHOLD_VIEWER],
  [UserRole.HOUSEHOLD_ADMIN]: [UserRole.HOUSEHOLD_ADMIN, UserRole.HOUSEHOLD_MEMBER, UserRole.HOUSEHOLD_VIEWER],
  [UserRole.HOUSEHOLD_MEMBER]: [UserRole.HOUSEHOLD_MEMBER, UserRole.HOUSEHOLD_VIEWER],
  [UserRole.HOUSEHOLD_VIEWER]: [UserRole.HOUSEHOLD_VIEWER],
};

/**
 * Guard that enforces role-based access control
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from decorator
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No roles required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required for role-based access');
    }

    // Phase 1: Get user role from database lookup or default assignment
    // Phase 2: This will come from JWT token claims
    const userRole = this.getUserRole(user);

    // Check if user has any of the required roles (including hierarchy)
    const hasPermission = requiredRoles.some(requiredRole => 
      this.hasRole(userRole, requiredRole)
    );

    if (!hasPermission) {
      throw new ForbiddenException(`Access denied. Required roles: ${requiredRoles.join(', ')}`);
    }

    return true;
  }

  /**
   * Check if user role includes the required role (considering hierarchy)
   */
  private hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
    const allowedRoles = ROLE_HIERARCHY[userRole] || [];
    return allowedRoles.includes(requiredRole);
  }

  /**
   * Get user role - Phase 1 implementation
   * Phase 2: This will be extracted from JWT claims
   */
  private getUserRole(user: any): UserRole {
    // Phase 1: Default role assignment based on headers
    if (user.roles?.includes('household_admin')) {
      return UserRole.HOUSEHOLD_ADMIN;
    }
    if (user.roles?.includes('household_member')) {
      return UserRole.HOUSEHOLD_MEMBER;
    }
    return UserRole.HOUSEHOLD_VIEWER; // Default fallback
  }
}
import { SetMetadata, applyDecorators, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard, UserRole } from '../guards/roles.guard';

/**
 * Mark a route as public (no authentication required)
 */
export const Public = () => SetMetadata('isPublic', true);

/**
 * Require specific roles for access
 */
export const RequireRoles = (...roles: UserRole[]) => SetMetadata('roles', roles);

/**
 * Require authentication (with optional role requirements)
 */
export const RequireAuth = (roles?: UserRole[]) => {
  const decorators = [UseGuards(AuthGuard)];
  
  if (roles && roles.length > 0) {
    decorators.push(UseGuards(RolesGuard), RequireRoles(...roles));
  }
  
  return applyDecorators(...decorators);
};

/**
 * Convenient decorators for common role requirements
 */
export const RequireHouseholdAdmin = () => 
  RequireAuth([UserRole.HOUSEHOLD_ADMIN]);

export const RequireHouseholdMember = () => 
  RequireAuth([UserRole.HOUSEHOLD_MEMBER]);

export const RequireSystemAdmin = () => 
  RequireAuth([UserRole.ADMIN]);

/**
 * Require any authenticated user (any role)
 */
export const RequireAnyRole = () => RequireAuth();
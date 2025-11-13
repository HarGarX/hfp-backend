import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class HouseholdGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.household_id) {
      throw new ForbiddenException('User must belong to a household');
    }

    // Inject household_id into request for use in services
    request.household_id = user.household_id;
    return true;
  }
}

export const HouseholdScoped = () => {
  // This decorator can be used to mark endpoints that require household context
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    // Implementation for metadata setting
  };
};
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentHousehold = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    // Get household_id from user context or injected by HouseholdGuard
    return request.user?.household_id || request.household_id;
  },
);
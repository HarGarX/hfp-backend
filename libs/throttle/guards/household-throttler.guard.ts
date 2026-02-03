import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';

/**
 * Per-household rate limiting guard
 * Tracks requests by household_id to prevent abuse from a single household
 */
@Injectable()
export class HouseholdThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const user = req.user;
    
    // Track by household_id if available
    if (user?.household_id) {
      return `household:${user.household_id}`;
    }
    
    // Fallback to user ID
    if (user?.id) {
      return `user:${user.id}`;
    }
    
    // Last resort: IP address
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }

  protected async getThrottlerConfig(context: ExecutionContext) {
    // Per-household limit: 5000 requests per hour
    return [{
      ttl: 3600000, // 1 hour
      limit: 5000,
    }];
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const response = context.switchToHttp().getResponse();
    
    try {
      const result = await super.canActivate(context);
      
      // Add household-specific rate limit headers
      response.setHeader('X-Household-RateLimit-Limit', 5000);
      response.setHeader('X-Household-RateLimit-TTL', 3600);
      
      return result;
    } catch (error) {
      response.setHeader('Retry-After', 3600);
      response.setHeader('X-Household-RateLimit-Limit', 5000);
      response.setHeader('X-Household-RateLimit-Remaining', 0);
      
      throw new ThrottlerException(
        'Household rate limit exceeded. Your household has made too many requests. Please try again later.'
      );
    }
  }
}

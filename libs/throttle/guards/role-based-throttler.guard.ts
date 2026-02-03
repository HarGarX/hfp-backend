import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { UserRole } from '../../../src/users/entities/user.entity';

@Injectable()
export class RoleBasedThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Track by user ID if authenticated, otherwise by IP
    const user = req.user;
    if (user?.id) {
      return `user:${user.id}`;
    }
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }

  protected async getThrottlerConfig(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Determine rate limit based on user role
    if (!user) {
      // Anonymous users
      return [{
        ttl: 3600000, // 1 hour
        limit: 100,
      }];
    }

    // Admin users get higher limits
    if (user.role === UserRole.ADMIN || user.role === UserRole.HOUSEHOLD_ADMIN) {
      return [{
        ttl: 3600000,
        limit: 10000,
      }];
    }

    // Authenticated users
    return [{
      ttl: 3600000,
      limit: 1000,
    }];
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const response = context.switchToHttp().getResponse();
    const throttlerConfigs = await this.getThrottlerConfig(context);
    
    try {
      const result = await super.canActivate(context);
      
      // Add rate limit headers
      if (throttlerConfigs && throttlerConfigs.length > 0) {
        const config = throttlerConfigs[0];
        response.setHeader('X-RateLimit-Limit', config.limit);
        response.setHeader('X-RateLimit-TTL', Math.floor(config.ttl / 1000));
      }
      
      return result;
    } catch (error) {
      // Add Retry-After header on rate limit exceeded
      if (throttlerConfigs && throttlerConfigs.length > 0) {
        const config = throttlerConfigs[0];
        const retryAfter = Math.ceil(config.ttl / 1000);
        response.setHeader('Retry-After', retryAfter);
        response.setHeader('X-RateLimit-Limit', config.limit);
        response.setHeader('X-RateLimit-Remaining', 0);
      }
      
      throw error;
    }
  }
}

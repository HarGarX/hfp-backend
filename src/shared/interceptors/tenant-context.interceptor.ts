import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextService } from '../../../libs/tenant';

/**
 * Interceptor to set tenant context from JWT payload
 * This should run after JWT authentication to populate household context
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantContextInterceptor.name);
  
  constructor(private readonly tenantContextService: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Debug logging
    this.logger.debug(`Request user object: ${JSON.stringify(user)}`);

    // If user is authenticated and has household_id, set tenant context
    if (user && user.household_id) {
      this.logger.debug(`Setting tenant context: tenantId=${user.household_id}, userId=${user.id}`);
      this.tenantContextService.setTenantContext({
        tenantId: user.household_id,
        userId: user.id,
      });
    } else {
      this.logger.warn(`Cannot set tenant context - user: ${!!user}, household_id: ${user?.household_id}`);
    }

    return next.handle();
  }
}

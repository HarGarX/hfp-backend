import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextService } from '../services/tenant-context.service';
import { AUTH_HEADERS } from '../tenant.types';

/**
 * Interceptor that extracts tenant context from request headers
 * and makes it available throughout the request lifecycle
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantContextService: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    // Extract tenant information from headers
    const tenantId = request.headers[AUTH_HEADERS.TENANT_ID];
    const userId = request.headers[AUTH_HEADERS.USER_ID];

    if (!tenantId) {
      // For now, we'll allow requests without tenant ID
      // In production, this should throw an UnauthorizedException
      console.warn('Request made without tenant ID header');
    } else if (this.tenantContextService) {
      // Set tenant context for this request (with null check)
      this.tenantContextService.setTenantContext({
        tenantId,
        userId,
      });
    } else {
      console.error('TenantContextService not available in TenantInterceptor');
    }

    return next.handle();
  }
}
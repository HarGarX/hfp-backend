import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    
    // Try to get tenant/user info from JWT (request.user) first, then fall back to headers
    const user = request.user;
    const tenantId = user?.household_id || request.headers['x-tenant-id'];
    const userId = user?.id || request.headers['x-user-id'];
    
    const startTime = Date.now();
    
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.log({
          message: 'Request completed',
          method,
          url,
          tenantId,
          userId,
          duration,
          timestamp: new Date().toISOString(),
        });
      }),
    );
  }
}
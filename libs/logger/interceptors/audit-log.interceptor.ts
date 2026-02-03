import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AuditLogService } from '../services/audit-log.service';
import { AUDIT_LOG_KEY, AuditLogMetadata } from '../decorators/audit-log.decorator';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditMetadata = this.reflector.get<AuditLogMetadata>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    if (!auditMetadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { user, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';

    return next.handle().pipe(
      tap((response) => {
        // Extract resource ID from response or request params
        const resourceId = response?.id || request.params?.id;

        this.auditLogService.log({
          action: auditMetadata.action,
          resource: auditMetadata.resource,
          resourceId,
          userId: user?.userId || 'anonymous',
          householdId: user?.householdId,
          ipAddress: ip,
          userAgent,
          metadata: {
            params: request.params,
            query: request.query,
          },
        });
      }),
    );
  }
}

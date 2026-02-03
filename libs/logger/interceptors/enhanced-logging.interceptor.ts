import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';

@Injectable()
export class EnhancedLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(EnhancedLoggingInterceptor.name);

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly winstonLogger: WinstonLogger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, body, headers, ip } = request;
    const userAgent = headers['user-agent'] || '';
    const startTime = Date.now();

    // Extract user information if available
    const user = request.user || {};
    const userId = user.userId || 'anonymous';
    const householdId = user.householdId || 'none';

    // Request ID for tracing
    const requestId = headers['x-request-id'] || this.generateRequestId();

    // Log incoming request
    this.winstonLogger.info('Incoming request', {
      context: 'HTTP',
      requestId,
      method,
      url,
      ip,
      userAgent,
      userId,
      householdId,
      body: this.sanitizeBody(body),
    });

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        const { statusCode } = response;

        // Log response
        this.winstonLogger.info('Request completed', {
          context: 'HTTP',
          requestId,
          method,
          url,
          statusCode,
          duration: `${duration}ms`,
          userId,
          householdId,
        });

        // Log slow requests (> 1000ms)
        if (duration > 1000) {
          this.winstonLogger.warn('Slow request detected', {
            context: 'Performance',
            requestId,
            method,
            url,
            duration: `${duration}ms`,
            userId,
            householdId,
          });
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const { statusCode } = response;

        // Log error with full context
        this.winstonLogger.error('Request failed', {
          context: 'HTTP',
          requestId,
          method,
          url,
          statusCode,
          duration: `${duration}ms`,
          userId,
          householdId,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        });

        throw error;
      }),
    );
  }

  /**
   * Sanitize request body to remove sensitive information
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard'];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { RequestValidationMiddleware } from './middleware/request-validation.middleware';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';
import { TenantModule } from '../tenant';

/**
 * Authentication and authorization module for Phase 1
 * Provides header-based auth, role-based access control, and security middleware
 */
@Module({
  imports: [TenantModule],
  providers: [
    Reflector, // Ensure Reflector is available for injection
    AuthGuard,
    RolesGuard,
    RequestValidationMiddleware,
    RateLimitMiddleware,
    // Note: Removing global guard to avoid DI issues in Phase 1
    // Controllers will explicitly use @RequireAuth() decorator instead
  ],
  exports: [
    Reflector,
    AuthGuard,
    RolesGuard,
    RequestValidationMiddleware,
    RateLimitMiddleware,
  ],
})
export class AuthModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply security middleware globally
    consumer
      .apply(RateLimitMiddleware, RequestValidationMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
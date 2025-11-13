import { Module, Global } from '@nestjs/common';
import { TenantInterceptor } from './interceptors/tenant.interceptor';
import { TenantContextService } from './services/tenant-context.service';
import { HouseholdScopeGuard } from './decorators/household-scoped.decorator';

/**
 * Tenant module providing multi-tenant isolation capabilities
 * This module is marked as @Global to make services available throughout the app
 */
@Global()
@Module({
  providers: [
    TenantContextService,
    HouseholdScopeGuard,
    TenantInterceptor, // Remove from global APP_INTERCEPTOR
  ],
  exports: [
    TenantContextService,
    HouseholdScopeGuard,
    TenantInterceptor,
  ],
})
export class TenantModule {}
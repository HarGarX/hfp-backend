import { Module } from '@nestjs/common';
import { HouseholdGuard } from './guards/household.guard';
import { TenantContextInterceptor } from './interceptors/tenant-context.interceptor';
import { TenantModule } from '../../libs/tenant';

@Module({
  imports: [TenantModule],
  providers: [HouseholdGuard, TenantContextInterceptor],
  exports: [HouseholdGuard, TenantContextInterceptor],
})
export class SharedModule {}

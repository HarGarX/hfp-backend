import { Module } from '@nestjs/common';
import { HouseholdGuard } from './guards/household.guard';

@Module({
  providers: [HouseholdGuard],
  exports: [HouseholdGuard],
})
export class SharedModule {}

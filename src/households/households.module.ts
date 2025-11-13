import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HouseholdsService } from './households.service';
import { HouseholdsController } from './households.controller';
import { Household } from './entities/household.entity';
import { HouseholdRepository } from './repositories/household.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Household])],
  controllers: [HouseholdsController],
  providers: [HouseholdsService, HouseholdRepository],
  exports: [HouseholdsService, HouseholdRepository],
})
export class HouseholdsModule {}

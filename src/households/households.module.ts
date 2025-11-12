import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HouseholdsService } from './households.service';
import { HouseholdsController } from './households.controller';
import { Household } from './entities/household.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Household])],
  controllers: [HouseholdsController],
  providers: [HouseholdsService],
  exports: [HouseholdsService],
})
export class HouseholdsModule {}

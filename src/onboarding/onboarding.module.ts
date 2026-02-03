import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import { OnboardingStatus } from './entities/onboarding-status.entity';
import { User } from '../users/entities/user.entity';
import { Household } from '../households/entities/household.entity';
import { UsersModule } from '../users/users.module';
import { HouseholdsModule } from '../households/households.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OnboardingStatus, User, Household]),
    UsersModule,
    HouseholdsModule,
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
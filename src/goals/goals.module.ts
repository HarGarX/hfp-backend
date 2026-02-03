import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Goal } from './entities/goal.entity';
import { GoalActivity } from './entities/goal-activity.entity';
import { Account } from '../accounts/entities/account.entity';
import { Category } from '../expenses/entities/category.entity';
import { GoalsService } from './services/goals.service';
import { GoalsController } from './controllers/goals.controller';
import { GoalRepository } from './repositories/goal.repository';
import { GoalActivityRepository } from './repositories/goal-activity.repository';
import { AccountsRepository } from '../accounts/repositories/accounts.repository';
import { CategoryRepository } from '../expenses/repositories/category.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Goal, GoalActivity, Account, Category]),
  ],
  controllers: [GoalsController],
  providers: [
    GoalsService,
    GoalRepository,
    GoalActivityRepository,
    AccountsRepository,
    CategoryRepository,
  ],
  exports: [GoalsService, GoalRepository],
})
export class GoalsModule {}

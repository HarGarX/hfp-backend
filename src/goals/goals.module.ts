import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Goal } from './entities/goal.entity';
import { GoalActivity } from './entities/goal-activity.entity';
import { Account } from '../accounts/entities/account.entity';
import { Category } from '../expenses/entities/category.entity';
import { GoalsService } from './services/goals.service';
import { GoalsController } from './controllers/goals.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Goal, GoalActivity, Account, Category]),
  ],
  controllers: [GoalsController],
  providers: [GoalsService],
  exports: [GoalsService],
})
export class GoalsModule {}

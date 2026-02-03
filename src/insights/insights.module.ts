import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Insight, FinancialHealthScore } from './entities';
import { InsightsService } from './services/insights.service';
import { FinancialHealthScoreService } from './services/financial-health-score.service';
import { InsightsController } from './controllers/insights.controller';
import { HealthScoreController } from './controllers/health-score.controller';
import { InsightRepository } from './repositories/insight.repository';
import { FinancialHealthScoreRepository } from './repositories/financial-health-score.repository';

// Import related entities for analysis
import { Transaction } from '../expenses/entities/transaction.entity';
import { Category } from '../expenses/entities/category.entity';
import { Account } from '../accounts/entities/account.entity';
import { Goal } from '../goals/entities/goal.entity';
import { Loan } from '../loans/entities/loan.entity';

// Import related repositories
import { TransactionRepository } from '../expenses/repositories/transaction.repository';
import { CategoryRepository } from '../expenses/repositories/category.repository';
import { AccountsRepository } from '../accounts/repositories/accounts.repository';
import { GoalRepository } from '../goals/repositories/goal.repository';
import { LoanRepository } from '../loans/repositories/loan.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Insight,
      FinancialHealthScore,
      Transaction,
      Category,
      Account,
      Goal,
      Loan,
    ]),
  ],
  controllers: [InsightsController, HealthScoreController],
  providers: [
    InsightsService,
    FinancialHealthScoreService,
    InsightRepository,
    FinancialHealthScoreRepository,
    TransactionRepository,
    CategoryRepository,
    AccountsRepository,
    GoalRepository,
    LoanRepository,
  ],
  exports: [InsightsService, FinancialHealthScoreService],
})
export class InsightsModule {}

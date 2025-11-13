import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreModule, AppConfigService } from '../libs/core';
import { TenantModule } from '../libs/tenant';
import { AuthModule } from '../libs/auth-placeholder';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HouseholdsModule } from './households/households.module';
import { UsersModule } from './users/users.module';
import { AccountsModule } from './accounts/accounts.module';
import { ExpensesModule } from './expenses/expenses.module';
import { LoansModule } from './loans/loans.module';
import { GoalsModule } from './goals/goals.module';
import { InsightsModule } from './insights/insights.module';
import { SimulationsModule } from './simulations/simulations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SharedModule } from './shared/shared.module';
import { SecurityTestModule } from './security-test/security-test.module';
import { Household } from './households/entities/household.entity';
import { User } from './users/entities/user.entity';
import { Account } from './accounts/entities/account.entity';
import { Transaction } from './expenses/entities/transaction.entity';
import { Category } from './expenses/entities/category.entity';
import { Goal } from './goals/entities/goal.entity';
import { GoalActivity } from './goals/entities/goal-activity.entity';
import { Loan } from './loans/entities/loan.entity';
import { LoanPayment } from './loans/entities/loan-payment.entity';
import { Insight } from './insights/entities/insight.entity';
import { FinancialHealthScore } from './insights/entities/financial-health-score.entity';
import { Notification } from './notifications/entities/notification.entity';
import { NotificationPreferences } from './notifications/entities/notification-preferences.entity';
import { NotificationTemplate } from './notifications/entities/notification-template.entity';

@Module({
  imports: [
    CoreModule,
    TenantModule,
    TypeOrmModule.forRootAsync({
      useFactory: (configService: AppConfigService) => ({
        type: 'postgres',
        ...configService.database,
        entities: [Household, User, Account, Transaction, Category, Goal, GoalActivity, Loan, LoanPayment, Insight, FinancialHealthScore, Notification, NotificationPreferences, NotificationTemplate],
      }),
      inject: [AppConfigService],
    }),
    AuthModule, 
    HouseholdsModule, 
    UsersModule, 
    AccountsModule, 
    ExpensesModule, 
    LoansModule, 
    GoalsModule, 
    InsightsModule, 
    SimulationsModule, 
    NotificationsModule, 
    SecurityTestModule,
    SharedModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

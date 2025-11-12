import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
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
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: +configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        entities: [Household, User, Account, Transaction, Category, Goal, GoalActivity, Loan, LoanPayment, Insight, FinancialHealthScore, Notification, NotificationPreferences, NotificationTemplate],
        synchronize: false, // Use migrations instead
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
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
    SharedModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { Category } from './entities/category.entity';
import { Account } from '../accounts/entities/account.entity';
import { TransactionService } from './services/transaction.service';
import { CategoryService } from './services/category.service';
import { TransactionController } from './controllers/transaction.controller';
import { CategoryController } from './controllers/category.controller';
import { TransactionRepository } from './repositories/transaction.repository';
import { CategoryRepository } from './repositories/category.repository';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Category, Account]),
    AccountsModule,
  ],
  controllers: [TransactionController, CategoryController],
  providers: [TransactionService, CategoryService, TransactionRepository, CategoryRepository],
  exports: [TransactionService, CategoryService],
})
export class ExpensesModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { Category } from './entities/category.entity';
import { Account } from '../accounts/entities/account.entity';
import { TransactionService } from './services/transaction.service';
import { CategoryService } from './services/category.service';
import { TransactionController } from './controllers/transaction.controller';
import { CategoryController } from './controllers/category.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Category, Account]),
  ],
  controllers: [TransactionController, CategoryController],
  providers: [TransactionService, CategoryService],
  exports: [TransactionService, CategoryService],
})
export class ExpensesModule {}

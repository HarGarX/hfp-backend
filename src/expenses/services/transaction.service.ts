import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, Between, Like, In } from 'typeorm';
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity';
import { CreateTransactionDto, UpdateTransactionDto } from '../dto';
import { Account } from '../../accounts/entities/account.entity';

export interface TransactionQueryOptions {
  search?: string;
  transaction_type?: TransactionType;
  status?: TransactionStatus;
  category_id?: string;
  account_id?: string;
  start_date?: string;
  end_date?: string;
  min_amount?: number;
  max_amount?: number;
  tags?: string[];
  page?: number;
  limit?: number;
}

export interface TransactionSummary {
  totalTransactions: number;
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  averageTransactionAmount: number;
  transactionsByType: Record<TransactionType, number>;
  transactionsByStatus: Record<TransactionStatus, number>;
}

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  async create(
    createTransactionDto: CreateTransactionDto,
    householdId: string,
    userId: string,
  ): Promise<Transaction> {
    // Validate account belongs to household
    const account = await this.accountRepository.findOne({
      where: { id: createTransactionDto.account_id, household_id: householdId },
    });

    if (!account) {
      throw new NotFoundException('Account not found or does not belong to household');
    }

    // Validate transfer account if provided
    if (createTransactionDto.transfer_account_id) {
      const transferAccount = await this.accountRepository.findOne({
        where: { id: createTransactionDto.transfer_account_id, household_id: householdId },
      });

      if (!transferAccount) {
        throw new NotFoundException('Transfer account not found or does not belong to household');
      }

      if (createTransactionDto.transaction_type !== TransactionType.TRANSFER) {
        throw new BadRequestException('Transfer account can only be specified for transfer transactions');
      }
    }

    // Validate transfer transactions require transfer_account_id
    if (createTransactionDto.transaction_type === TransactionType.TRANSFER && !createTransactionDto.transfer_account_id) {
      throw new BadRequestException('Transfer account is required for transfer transactions');
    }

    // Validate recurring transaction fields
    if (createTransactionDto.is_recurring && !createTransactionDto.recurring_frequency) {
      throw new BadRequestException('Recurring frequency is required for recurring transactions');
    }

    const transaction = this.transactionRepository.create({
      ...createTransactionDto,
      household_id: householdId,
      created_by: userId,
      date: new Date(createTransactionDto.date),
      recurring_end_date: createTransactionDto.recurring_end_date 
        ? new Date(createTransactionDto.recurring_end_date) 
        : undefined,
    });

    return this.transactionRepository.save(transaction);
  }

  async findAll(
    householdId: string,
    options: TransactionQueryOptions = {},
  ): Promise<{ transactions: Transaction[]; meta: any }> {
    const {
      search,
      transaction_type,
      status,
      category_id,
      account_id,
      start_date,
      end_date,
      min_amount,
      max_amount,
      tags,
      page = 1,
      limit = 50,
    } = options;

    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.account', 'account')
      .leftJoinAndSelect('transaction.category', 'category')
      .leftJoinAndSelect('transaction.transfer_account', 'transfer_account')
      .leftJoinAndSelect('transaction.created_by_user', 'user')
      .where('transaction.household_id = :householdId', { householdId })
      .orderBy('transaction.date', 'DESC')
      .addOrderBy('transaction.created_at', 'DESC');

    // Apply filters
    if (search) {
      query.andWhere(
        '(transaction.description ILIKE :search OR transaction.merchant ILIKE :search OR transaction.notes ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (transaction_type) {
      query.andWhere('transaction.transaction_type = :transaction_type', { transaction_type });
    }

    if (status) {
      query.andWhere('transaction.status = :status', { status });
    }

    if (category_id) {
      query.andWhere('transaction.category_id = :category_id', { category_id });
    }

    if (account_id) {
      query.andWhere('(transaction.account_id = :account_id OR transaction.transfer_account_id = :account_id)', { account_id });
    }

    if (start_date) {
      query.andWhere('transaction.date >= :start_date', { start_date });
    }

    if (end_date) {
      query.andWhere('transaction.date <= :end_date', { end_date });
    }

    if (min_amount !== undefined) {
      query.andWhere('transaction.amount >= :min_amount', { min_amount });
    }

    if (max_amount !== undefined) {
      query.andWhere('transaction.amount <= :max_amount', { max_amount });
    }

    if (tags && tags.length > 0) {
      query.andWhere('transaction.tags && :tags', { tags });
    }

    // Pagination
    const offset = (page - 1) * limit;
    query.skip(offset).take(limit);

    const [transactions, total] = await query.getManyAndCount();

    return {
      transactions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, householdId: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id, household_id: householdId },
      relations: ['account', 'category', 'transfer_account', 'created_by_user'],
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  async update(
    id: string,
    householdId: string,
    updateTransactionDto: UpdateTransactionDto,
    userId: string,
  ): Promise<Transaction> {
    const transaction = await this.findOne(id, householdId);

    // Validate account if being updated
    if (updateTransactionDto.account_id && updateTransactionDto.account_id !== transaction.account_id) {
      const account = await this.accountRepository.findOne({
        where: { id: updateTransactionDto.account_id, household_id: householdId },
      });

      if (!account) {
        throw new NotFoundException('Account not found or does not belong to household');
      }
    }

    // Validate transfer account if being updated
    if (updateTransactionDto.transfer_account_id) {
      const transferAccount = await this.accountRepository.findOne({
        where: { id: updateTransactionDto.transfer_account_id, household_id: householdId },
      });

      if (!transferAccount) {
        throw new NotFoundException('Transfer account not found or does not belong to household');
      }
    }

    Object.assign(transaction, {
      ...updateTransactionDto,
      date: updateTransactionDto.date ? new Date(updateTransactionDto.date) : transaction.date,
      recurring_end_date: updateTransactionDto.recurring_end_date 
        ? new Date(updateTransactionDto.recurring_end_date) 
        : transaction.recurring_end_date,
    });

    return this.transactionRepository.save(transaction);
  }

  async remove(id: string, householdId: string): Promise<void> {
    const transaction = await this.findOne(id, householdId);
    await this.transactionRepository.softDelete(id);
  }

  async getTransactionSummary(
    householdId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<TransactionSummary> {
    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.household_id = :householdId', { householdId })
      .andWhere('transaction.status = :status', { status: TransactionStatus.COMPLETED });

    if (startDate) {
      query.andWhere('transaction.date >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('transaction.date <= :endDate', { endDate });
    }

    const transactions = await query.getMany();

    const totalTransactions = transactions.length;
    const totalIncome = transactions
      .filter(t => t.transaction_type === TransactionType.INCOME)
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const totalExpenses = transactions
      .filter(t => t.transaction_type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const netAmount = totalIncome - totalExpenses;
    const averageTransactionAmount = totalTransactions > 0 
      ? transactions.reduce((sum, t) => sum + Number(t.amount), 0) / totalTransactions 
      : 0;

    // Group by type
    const transactionsByType = transactions.reduce((acc, transaction) => {
      acc[transaction.transaction_type] = (acc[transaction.transaction_type] || 0) + 1;
      return acc;
    }, {} as Record<TransactionType, number>);

    // Group by status
    const transactionsByStatus = transactions.reduce((acc, transaction) => {
      acc[transaction.status] = (acc[transaction.status] || 0) + 1;
      return acc;
    }, {} as Record<TransactionStatus, number>);

    return {
      totalTransactions,
      totalIncome,
      totalExpenses,
      netAmount,
      averageTransactionAmount,
      transactionsByType,
      transactionsByStatus,
    };
  }

  async updateStatus(
    id: string,
    householdId: string,
    status: TransactionStatus,
  ): Promise<Transaction> {
    const transaction = await this.findOne(id, householdId);
    transaction.status = status;
    return this.transactionRepository.save(transaction);
  }

  async duplicateTransaction(
    id: string,
    householdId: string,
    userId: string,
  ): Promise<Transaction> {
    const originalTransaction = await this.findOne(id, householdId);
    
    const duplicateData = {
      ...originalTransaction,
      id: undefined,
      created_at: undefined,
      updated_at: undefined,
      created_by: userId,
      description: `${originalTransaction.description} (Copy)`,
      status: TransactionStatus.PENDING,
    };

    delete duplicateData.id;
    delete duplicateData.created_at;
    delete duplicateData.updated_at;

    const newTransaction = this.transactionRepository.create(duplicateData);
    return this.transactionRepository.save(newTransaction);
  }
}
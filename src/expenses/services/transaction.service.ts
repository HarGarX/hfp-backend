import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CacheService } from '../../../libs/cache';
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity';
import { CreateTransactionDto, UpdateTransactionDto } from '../dto';
import { TransactionRepository } from '../repositories/transaction.repository';
import { AccountsRepository } from '../../accounts/repositories/accounts.repository';

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
  private readonly CACHE_TTL = 180; // 3 minutes (shorter for frequently changing data)
  
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly accountRepository: AccountsRepository,
    private readonly cacheService: CacheService,
  ) {}

  async create(
    createTransactionDto: CreateTransactionDto,
    householdId: string,
    userId: string,
  ): Promise<Transaction> {
    // Validate account belongs to household
    const account = await this.accountRepository.findByIdWithHousehold(
      householdId,
      createTransactionDto.account_id,
    );

    if (!account) {
      throw new NotFoundException('Account not found or does not belong to household');
    }

    // Validate transfer account if provided
    if (createTransactionDto.transfer_account_id) {
      const transferAccount = await this.accountRepository.findByIdWithHousehold(
        householdId,
        createTransactionDto.transfer_account_id,
      );

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

    const savedTransaction = await this.transactionRepository.saveWithHousehold(householdId, transaction);
    
    // Invalidate transaction cache
    await this.cacheService.del(householdId, 'transactions:list');
    await this.cacheService.del(householdId, 'transactions:summary');
    
    return savedTransaction;
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
      .createQueryBuilderWithHousehold(householdId, 'transaction')
      .leftJoinAndSelect('transaction.account', 'account')
      .leftJoinAndSelect('transaction.category', 'category')
      .leftJoinAndSelect('transaction.transfer_account', 'transfer_account')
      .leftJoinAndSelect('transaction.created_by_user', 'user')
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
    // Try cache first
    const cacheKey = `transactions:${id}`;
    const cached = await this.cacheService.get<Transaction>(householdId, cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const transaction = await this.transactionRepository.findOneWithHousehold(householdId, {
      where: { id },
      relations: ['account', 'category', 'transfer_account', 'created_by_user'],
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Cache the result
    await this.cacheService.set(householdId, cacheKey, transaction, this.CACHE_TTL);

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
      const account = await this.accountRepository.findByIdWithHousehold(
        householdId,
        updateTransactionDto.account_id,
      );

      if (!account) {
        throw new NotFoundException('Account not found or does not belong to household');
      }
    }

    // Validate transfer account if being updated
    if (updateTransactionDto.transfer_account_id) {
      const transferAccount = await this.accountRepository.findByIdWithHousehold(
        householdId,
        updateTransactionDto.transfer_account_id,
      );

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

    const updated = await this.transactionRepository.saveWithHousehold(householdId, transaction);

    // Invalidate caches
    await this.cacheService.del(householdId, `transactions:${id}`);
    await this.cacheService.del(householdId, 'transactions:list');
    await this.cacheService.del(householdId, 'transactions:summary');

    return updated;
  }

  async remove(id: string, householdId: string): Promise<void> {
    const transaction = await this.findOne(id, householdId);
    await this.transactionRepository.softDelete(id);

    // Invalidate caches
    await this.cacheService.del(householdId, `transactions:${id}`);
    await this.cacheService.del(householdId, 'transactions:list');
    await this.cacheService.del(householdId, 'transactions:summary');
  }

  async getTransactionSummary(
    householdId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<TransactionSummary> {
    // Create unique cache key based on date filters
    const cacheKey = `transactions:summary:${startDate || 'all'}:${endDate || 'all'}`;

    return this.cacheService.wrap(
      householdId,
      cacheKey,
      async () => {
        const query = this.transactionRepository
          .createQueryBuilderWithHousehold(householdId, 'transaction')
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
      },
      this.CACHE_TTL,
    );
  }

  async updateStatus(
    id: string,
    householdId: string,
    status: TransactionStatus,
  ): Promise<Transaction> {
    const transaction = await this.findOne(id, householdId);
    transaction.status = status;
    const updated = await this.transactionRepository.saveWithHousehold(householdId, transaction);

    // Invalidate caches
    await this.cacheService.del(householdId, `transactions:${id}`);
    await this.cacheService.del(householdId, 'transactions:list');
    await this.cacheService.del(householdId, 'transactions:summary');

    return updated;
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
    const saved = await this.transactionRepository.saveWithHousehold(householdId, newTransaction);

    // Invalidate caches
    await this.cacheService.del(householdId, 'transactions:list');
    await this.cacheService.del(householdId, 'transactions:summary');

    return saved;
  }
}
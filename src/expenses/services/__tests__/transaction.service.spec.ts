import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TransactionService, TransactionQueryOptions } from '../transaction.service';
import { Transaction, TransactionType, TransactionStatus } from '../../entities/transaction.entity';
import { Account, AccountType, AccountStatus } from '../../../accounts/entities/account.entity';
import { CreateTransactionDto, UpdateTransactionDto } from '../../dto';

describe('TransactionService', () => {
  let service: TransactionService;
  let transactionRepository: jest.Mocked<Repository<Transaction>>;
  let accountRepository: jest.Mocked<Repository<Account>>;

  const mockHouseholdId = 'household-123';
  const mockUserId = 'user-123';
  const mockTransactionId = 'transaction-123';
  const mockAccountId = 'account-123';

  const mockTransaction = {
    id: mockTransactionId,
    household_id: mockHouseholdId,
    account_id: mockAccountId,
    amount: 100.00,
    transaction_type: TransactionType.EXPENSE,
    status: TransactionStatus.COMPLETED,
    description: 'Test transaction',
    date: new Date('2025-01-01'),
    currency: 'USD',
    created_by: mockUserId,
    created_at: new Date(),
    updated_at: new Date(),
    is_recurring: false,
  } as Transaction;

  const mockAccount = {
    id: mockAccountId,
    household_id: mockHouseholdId,
    name: 'Test Account',
    account_type: AccountType.CHECKING,
    status: AccountStatus.ACTIVE,
    current_balance: 1000.00,
    available_balance: 1000.00,
    currency: 'USD',
    bank_name: 'Test Bank',
    is_active: true,
    created_by: mockUserId,
    created_at: new Date(),
    updated_at: new Date(),
  } as Account;

  beforeEach(async () => {
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockTransaction], 1]),
      getOne: jest.fn().mockResolvedValue(mockTransaction),
      select: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            softDelete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Account),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
    transactionRepository = module.get(getRepositoryToken(Transaction));
    accountRepository = module.get(getRepositoryToken(Account));
  });

  describe('create', () => {
    const createTransactionDto: CreateTransactionDto = {
      account_id: mockAccountId,
      amount: 100.00,
      transaction_type: TransactionType.EXPENSE,
      description: 'Test transaction',
      date: '2025-01-01',
      currency: 'USD',
    };

    it('should create a new transaction', async () => {
      accountRepository.findOne.mockResolvedValue(mockAccount);
      transactionRepository.create.mockReturnValue(mockTransaction);
      transactionRepository.save.mockResolvedValue(mockTransaction);

      const result = await service.create(createTransactionDto, mockHouseholdId, mockUserId);

      expect(accountRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockAccountId, household_id: mockHouseholdId },
      });
      expect(transactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          account_id: mockAccountId,
          amount: 100.00,
          transaction_type: TransactionType.EXPENSE,
          description: 'Test transaction',
          currency: 'USD',
          household_id: mockHouseholdId,
          created_by: mockUserId,
        })
      );
      expect(transactionRepository.save).toHaveBeenCalledWith(mockTransaction);
      expect(result).toEqual(mockTransaction);
    });

    it('should throw NotFoundException when account not found', async () => {
      accountRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create(createTransactionDto, mockHouseholdId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate transfer account for transfer transactions', async () => {
      const transferDto: CreateTransactionDto = {
        ...createTransactionDto,
        transaction_type: TransactionType.TRANSFER,
        transfer_account_id: 'transfer-account-123',
      };

      accountRepository.findOne
        .mockResolvedValueOnce(mockAccount) // source account
        .mockResolvedValueOnce(mockAccount); // transfer account

      transactionRepository.create.mockReturnValue(mockTransaction);
      transactionRepository.save.mockResolvedValue(mockTransaction);

      await service.create(transferDto, mockHouseholdId, mockUserId);

      expect(accountRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException for transfer without transfer_account_id', async () => {
      const invalidTransferDto: CreateTransactionDto = {
        ...createTransactionDto,
        transaction_type: TransactionType.TRANSFER,
      };

      accountRepository.findOne.mockResolvedValue(mockAccount); // Mock account exists

      await expect(
        service.create(invalidTransferDto, mockHouseholdId, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated transactions with default options', async () => {
      const result = await service.findAll(mockHouseholdId, {});

      expect(result).toEqual({
        transactions: [mockTransaction],
        meta: {
          page: 1,
          limit: 50,
          total: 1,
          totalPages: 1,
        },
      });
    });

    it('should apply search filter', async () => {
      const options: TransactionQueryOptions = {
        search: 'test',
      };

      await service.findAll(mockHouseholdId, options);

      const queryBuilder = transactionRepository.createQueryBuilder();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(transaction.description ILIKE :search OR transaction.merchant ILIKE :search OR transaction.notes ILIKE :search)',
        { search: '%test%' }
      );
    });

    it('should apply date range filter', async () => {
      const options: TransactionQueryOptions = {
        start_date: '2025-01-01',
        end_date: '2025-01-31',
      };

      await service.findAll(mockHouseholdId, options);

      const queryBuilder = transactionRepository.createQueryBuilder();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.date >= :start_date',
        { start_date: '2025-01-01' }
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.date <= :end_date',
        { end_date: '2025-01-31' }
      );
    });

    it('should apply transaction type filter', async () => {
      const options: TransactionQueryOptions = {
        transaction_type: TransactionType.EXPENSE,
      };

      await service.findAll(mockHouseholdId, options);

      const queryBuilder = transactionRepository.createQueryBuilder();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.transaction_type = :transaction_type',
        { transaction_type: TransactionType.EXPENSE }
      );
    });

    it('should apply pagination', async () => {
      const options: TransactionQueryOptions = {
        page: 2,
        limit: 10,
      };

      await service.findAll(mockHouseholdId, options);

      const queryBuilder = transactionRepository.createQueryBuilder();
      expect(queryBuilder.skip).toHaveBeenCalledWith(10);
      expect(queryBuilder.take).toHaveBeenCalledWith(10);
    });
  });

  describe('findOne', () => {
    it('should return a transaction by id', async () => {
      transactionRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await service.findOne(mockTransactionId, mockHouseholdId);

      expect(transactionRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockTransactionId, household_id: mockHouseholdId },
        relations: ['account', 'category', 'transfer_account', 'created_by_user'],
      });
      expect(result).toEqual(mockTransaction);
    });

    it('should throw NotFoundException when transaction not found', async () => {
      transactionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne(mockTransactionId, mockHouseholdId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateTransactionDto: UpdateTransactionDto = {
      amount: 200.00,
      description: 'Updated transaction',
    };

    it('should update a transaction', async () => {
      const updatedTransaction = { ...mockTransaction, ...updateTransactionDto };
      
      transactionRepository.findOne.mockResolvedValue(mockTransaction);
      transactionRepository.save.mockResolvedValue(updatedTransaction as Transaction);

      const result = await service.update(
        mockTransactionId,
        mockHouseholdId,
        updateTransactionDto,
        mockUserId,
      );

      expect(transactionRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockTransactionId, household_id: mockHouseholdId },
        relations: ['account', 'category', 'transfer_account', 'created_by_user'],
      });
      expect(transactionRepository.save).toHaveBeenCalledWith({
        ...mockTransaction,
        ...updateTransactionDto,
      });
      expect(result).toEqual(updatedTransaction);
    });

    it('should throw NotFoundException when transaction not found', async () => {
      transactionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update(mockTransactionId, mockHouseholdId, updateTransactionDto, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete a transaction', async () => {
      transactionRepository.findOne.mockResolvedValue(mockTransaction);
      transactionRepository.softDelete.mockResolvedValue({ affected: 1 } as any);

      await service.remove(mockTransactionId, mockHouseholdId);

      expect(transactionRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockTransactionId, household_id: mockHouseholdId },
        relations: ['account', 'category', 'transfer_account', 'created_by_user'],
      });
      expect(transactionRepository.softDelete).toHaveBeenCalledWith(mockTransactionId);
    });

    it('should throw NotFoundException when transaction not found', async () => {
      transactionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.remove(mockTransactionId, mockHouseholdId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update transaction status', async () => {
      const updatedTransaction = { 
        ...mockTransaction, 
        status: TransactionStatus.RECONCILED 
      };
      
      transactionRepository.findOne.mockResolvedValue(mockTransaction);
      transactionRepository.save.mockResolvedValue(updatedTransaction as Transaction);

      const result = await service.updateStatus(
        mockTransactionId,
        mockHouseholdId,
        TransactionStatus.RECONCILED,
      );

      expect(result.status).toBe(TransactionStatus.RECONCILED);
    });

    it('should throw NotFoundException when transaction not found for status update', async () => {
      transactionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus(mockTransactionId, mockHouseholdId, TransactionStatus.RECONCILED),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('duplicateTransaction', () => {
    it('should duplicate transaction successfully', async () => {
      const originalTransaction = {
        ...mockTransaction,
        description: 'Original transaction',
        status: TransactionStatus.COMPLETED,
      };

      const duplicatedTransaction = {
        ...originalTransaction,
        id: 'new-transaction-id',
        description: 'Original transaction (Copy)',
        status: TransactionStatus.PENDING,
        created_by: mockUserId,
      };

      transactionRepository.findOne.mockResolvedValue(originalTransaction);
      transactionRepository.create.mockReturnValue(duplicatedTransaction as any);
      transactionRepository.save.mockResolvedValue(duplicatedTransaction as Transaction);

      const result = await service.duplicateTransaction(
        mockTransactionId,
        mockHouseholdId,
        mockUserId,
      );

      expect(transactionRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockTransactionId, household_id: mockHouseholdId },
        relations: ['account', 'category', 'transfer_account', 'created_by_user'],
      });
      expect(transactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Original transaction (Copy)',
          status: TransactionStatus.PENDING,
          created_by: mockUserId,
        }),
      );
      expect(result.description).toBe('Original transaction (Copy)');
      expect(result.status).toBe(TransactionStatus.PENDING);
    });

    it('should throw NotFoundException when original transaction not found for duplication', async () => {
      transactionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.duplicateTransaction(mockTransactionId, mockHouseholdId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTransactionSummary', () => {
    const mockIncomeTransaction = {
      ...mockTransaction,
      id: 'income-transaction',
      transaction_type: TransactionType.INCOME,
      amount: 500.00,
      status: TransactionStatus.COMPLETED,
    };

    const mockExpenseTransaction = {
      ...mockTransaction,
      id: 'expense-transaction',
      transaction_type: TransactionType.EXPENSE,
      amount: 200.00,
      status: TransactionStatus.COMPLETED,
    };

    const mockPendingTransaction = {
      ...mockTransaction,
      id: 'pending-transaction',
      transaction_type: TransactionType.EXPENSE,
      amount: 150.00,
      status: TransactionStatus.PENDING,
    };

    beforeEach(() => {
      const mockSummaryQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      transactionRepository.createQueryBuilder.mockReturnValue(mockSummaryQueryBuilder as any);
    });

    it('should calculate transaction summary without date filters', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          mockIncomeTransaction,
          mockExpenseTransaction,
          { ...mockExpenseTransaction, id: 'expense-2', amount: 100.00 }
        ]),
      };

      transactionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getTransactionSummary(mockHouseholdId);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'transaction.household_id = :householdId',
        { householdId: mockHouseholdId }
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.status = :status',
        { status: TransactionStatus.COMPLETED }
      );
      
      expect(result).toEqual({
        totalTransactions: 3,
        totalIncome: 500.00,
        totalExpenses: 300.00,
        netAmount: 200.00,
        averageTransactionAmount: 800.00 / 3, // 266.67
        transactionsByType: {
          [TransactionType.INCOME]: 1,
          [TransactionType.EXPENSE]: 2,
        },
        transactionsByStatus: {
          [TransactionStatus.COMPLETED]: 3,
        },
      });
    });

    it('should calculate transaction summary with start date filter', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockIncomeTransaction]),
      };

      transactionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getTransactionSummary(
        mockHouseholdId,
        '2025-01-01'
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.date >= :startDate',
        { startDate: '2025-01-01' }
      );
      expect(result.totalTransactions).toBe(1);
      expect(result.totalIncome).toBe(500.00);
    });

    it('should calculate transaction summary with end date filter', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockExpenseTransaction]),
      };

      transactionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getTransactionSummary(
        mockHouseholdId,
        undefined,
        '2025-12-31'
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.date <= :endDate',
        { endDate: '2025-12-31' }
      );
      expect(result.totalExpenses).toBe(200.00);
    });

    it('should calculate transaction summary with both date filters', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockIncomeTransaction, mockExpenseTransaction]),
      };

      transactionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getTransactionSummary(
        mockHouseholdId,
        '2025-01-01',
        '2025-12-31'
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.date >= :startDate',
        { startDate: '2025-01-01' }
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.date <= :endDate',
        { endDate: '2025-12-31' }
      );
      expect(result.totalTransactions).toBe(2);
      expect(result.netAmount).toBe(300.00); // 500 - 200
    });

    it('should handle empty transaction list', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      transactionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getTransactionSummary(mockHouseholdId);

      expect(result).toEqual({
        totalTransactions: 0,
        totalIncome: 0,
        totalExpenses: 0,
        netAmount: 0,
        averageTransactionAmount: 0,
        transactionsByType: {},
        transactionsByStatus: {},
      });
    });

    it('should calculate summary with mixed transaction types', async () => {
      const transferTransaction = {
        ...mockTransaction,
        id: 'transfer-transaction',
        transaction_type: TransactionType.TRANSFER,
        amount: 300.00,
        status: TransactionStatus.COMPLETED,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          mockIncomeTransaction,
          mockExpenseTransaction,
          transferTransaction,
        ]),
      };

      transactionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getTransactionSummary(mockHouseholdId);

      expect(result.transactionsByType).toEqual({
        [TransactionType.INCOME]: 1,
        [TransactionType.EXPENSE]: 1,
        [TransactionType.TRANSFER]: 1,
      });
      expect(result.totalTransactions).toBe(3);
      expect(result.averageTransactionAmount).toBeCloseTo(333.33, 2);
    });
  });

  describe('findAll - comprehensive filter testing', () => {
    beforeEach(() => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockTransaction], 1]),
      };
      transactionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
    });

    it('should apply min_amount filter', async () => {
      const options: TransactionQueryOptions = { min_amount: 50.00 };

      await service.findAll(mockHouseholdId, options);

      const queryBuilder = transactionRepository.createQueryBuilder();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.amount >= :min_amount',
        { min_amount: 50.00 }
      );
    });

    it('should apply max_amount filter', async () => {
      const options: TransactionQueryOptions = { max_amount: 200.00 };

      await service.findAll(mockHouseholdId, options);

      const queryBuilder = transactionRepository.createQueryBuilder();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.amount <= :max_amount',
        { max_amount: 200.00 }
      );
    });

    it('should apply tags filter', async () => {
      const options: TransactionQueryOptions = { tags: ['business', 'travel'] };

      await service.findAll(mockHouseholdId, options);

      const queryBuilder = transactionRepository.createQueryBuilder();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.tags && :tags',
        { tags: ['business', 'travel'] }
      );
    });

    it('should apply multiple filters simultaneously', async () => {
      const options: TransactionQueryOptions = {
        search: 'test',
        transaction_type: TransactionType.EXPENSE,
        status: TransactionStatus.COMPLETED,
        category_id: 'category-123',
        min_amount: 10.00,
        max_amount: 500.00,
        start_date: '2025-01-01',
        end_date: '2025-12-31',
        page: 2,
        limit: 25,
      };

      await service.findAll(mockHouseholdId, options);

      const queryBuilder = transactionRepository.createQueryBuilder();
      
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(transaction.description ILIKE :search OR transaction.merchant ILIKE :search OR transaction.notes ILIKE :search)',
        { search: '%test%' }
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.transaction_type = :transaction_type',
        { transaction_type: TransactionType.EXPENSE }
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.status = :status',
        { status: TransactionStatus.COMPLETED }
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.category_id = :category_id',
        { category_id: 'category-123' }
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.amount >= :min_amount',
        { min_amount: 10.00 }
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.amount <= :max_amount',
        { max_amount: 500.00 }
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.date >= :start_date',
        { start_date: '2025-01-01' }
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.date <= :end_date',
        { end_date: '2025-12-31' }
      );
      expect(queryBuilder.skip).toHaveBeenCalledWith(25);
      expect(queryBuilder.take).toHaveBeenCalledWith(25);
    });

    it('should handle account_id filter with OR condition for transfer accounts', async () => {
      const options: TransactionQueryOptions = { account_id: 'account-456' };

      await service.findAll(mockHouseholdId, options);

      const queryBuilder = transactionRepository.createQueryBuilder();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(transaction.account_id = :account_id OR transaction.transfer_account_id = :account_id)',
        { account_id: 'account-456' }
      );
    });

    it('should return correct pagination metadata', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockTransaction, mockTransaction], 25]),
      };
      transactionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const options: TransactionQueryOptions = { page: 3, limit: 10 };

      const result = await service.findAll(mockHouseholdId, options);

      expect(result.meta).toEqual({
        page: 3,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
    });
  });

  describe('create - advanced scenarios', () => {
    it('should create transfer transaction with both accounts', async () => {
      const transferAccount = {
        ...mockAccount,
        id: 'transfer-account-123',
        name: 'Transfer Account',
      };

      const transferDto: CreateTransactionDto = {
        account_id: mockAccountId,
        transfer_account_id: 'transfer-account-123',
        amount: 150.00,
        transaction_type: TransactionType.TRANSFER,
        description: 'Transfer between accounts',
        date: '2025-01-01',
        currency: 'USD',
      };

      accountRepository.findOne
        .mockResolvedValueOnce(mockAccount) // Source account
        .mockResolvedValueOnce(transferAccount); // Transfer account

      transactionRepository.create.mockReturnValue(mockTransaction);
      transactionRepository.save.mockResolvedValue(mockTransaction);

      const result = await service.create(transferDto, mockHouseholdId, mockUserId);

      expect(accountRepository.findOne).toHaveBeenCalledTimes(2);
      expect(accountRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockAccountId, household_id: mockHouseholdId },
      });
      expect(accountRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'transfer-account-123', household_id: mockHouseholdId },
      });
      expect(result).toEqual(mockTransaction);
    });

    it('should throw BadRequestException for transfer without transfer_account_id', async () => {
      const invalidTransferDto: CreateTransactionDto = {
        account_id: mockAccountId,
        amount: 100.00,
        transaction_type: TransactionType.TRANSFER,
        description: 'Invalid transfer',
        date: '2025-01-01',
        currency: 'USD',
      };

      accountRepository.findOne.mockResolvedValue(mockAccount);

      await expect(
        service.create(invalidTransferDto, mockHouseholdId, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for invalid transfer account', async () => {
      const transferDto: CreateTransactionDto = {
        account_id: mockAccountId,
        transfer_account_id: 'invalid-transfer-account',
        amount: 100.00,
        transaction_type: TransactionType.TRANSFER,
        description: 'Transfer with invalid account',
        date: '2025-01-01',
        currency: 'USD',
      };

      accountRepository.findOne
        .mockResolvedValueOnce(mockAccount) // Source account exists
        .mockResolvedValueOnce(null); // Transfer account doesn't exist

      await expect(
        service.create(transferDto, mockHouseholdId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when transfer_account_id provided for non-transfer transaction', async () => {
      const invalidDto: CreateTransactionDto = {
        account_id: mockAccountId,
        transfer_account_id: 'some-account',
        amount: 100.00,
        transaction_type: TransactionType.EXPENSE,
        description: 'Non-transfer with transfer account',
        date: '2025-01-01',
        currency: 'USD',
      };

      accountRepository.findOne
        .mockResolvedValueOnce(mockAccount)
        .mockResolvedValueOnce(mockAccount);

      await expect(
        service.create(invalidDto, mockHouseholdId, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create transaction with all optional fields', async () => {
      const completeDto: CreateTransactionDto = {
        account_id: mockAccountId,
        amount: 75.99,
        transaction_type: TransactionType.EXPENSE,
        description: 'Complete transaction',
        date: '2025-01-15',
        currency: 'USD',
        category_id: 'category-123',
        merchant: 'Test Merchant',
        notes: 'Test notes',
        tags: ['business', 'meal'],
        is_recurring: true,
        recurring_frequency: 'monthly',
        recurring_end_date: '2025-12-31',
      };

      accountRepository.findOne.mockResolvedValue(mockAccount);
      transactionRepository.create.mockReturnValue(mockTransaction);
      transactionRepository.save.mockResolvedValue(mockTransaction);

      await service.create(completeDto, mockHouseholdId, mockUserId);

      expect(transactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          account_id: mockAccountId,
          amount: 75.99,
          transaction_type: TransactionType.EXPENSE,
          description: 'Complete transaction',
          date: new Date('2025-01-15'),
          currency: 'USD',
          category_id: 'category-123',
          merchant: 'Test Merchant',
          notes: 'Test notes',
          tags: ['business', 'meal'],
          is_recurring: true,
          recurring_frequency: 'monthly',
          recurring_end_date: new Date('2025-12-31'),
          household_id: mockHouseholdId,
          created_by: mockUserId,
        }),
      );
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle findOne with empty result gracefully', async () => {
      transactionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent-id', mockHouseholdId),
      ).rejects.toThrow(NotFoundException);

      expect(transactionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'nonexistent-id', household_id: mockHouseholdId },
        relations: ['account', 'category', 'transfer_account', 'created_by_user'],
      });
    });

    it('should handle update with invalid transaction ID', async () => {
      transactionRepository.findOne.mockResolvedValue(null);

      const updateDto: UpdateTransactionDto = {
        description: 'Updated description',
      };

      await expect(
        service.update('invalid-id', mockHouseholdId, updateDto, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update transaction with date conversion', async () => {
      const updateDto: UpdateTransactionDto = {
        description: 'Updated transaction',
        amount: 250.00,
        date: '2025-02-15',
        recurring_end_date: '2025-12-31',
      };

      const updatedTransaction = {
        ...mockTransaction,
        ...updateDto,
        date: new Date('2025-02-15'),
        recurring_end_date: new Date('2025-12-31'),
      };

      transactionRepository.findOne.mockResolvedValue(mockTransaction);
      transactionRepository.save.mockResolvedValue(updatedTransaction as Transaction);

      const result = await service.update(
        mockTransactionId,
        mockHouseholdId,
        updateDto,
        mockUserId,
      );

      expect(transactionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Updated transaction',
          amount: 250.00,
          date: new Date('2025-02-15'),
          recurring_end_date: new Date('2025-12-31'),
        }),
      );
    });

    it('should handle findAll with default pagination when no options provided', async () => {
      await service.findAll(mockHouseholdId);

      const queryBuilder = transactionRepository.createQueryBuilder();
      expect(queryBuilder.skip).toHaveBeenCalledWith(0); // Default page 1
      expect(queryBuilder.take).toHaveBeenCalledWith(50); // Default limit 50
    });

    it('should properly handle transaction creation when only required fields provided', async () => {
      const minimalDto: CreateTransactionDto = {
        account_id: mockAccountId,
        amount: 25.50,
        transaction_type: TransactionType.INCOME,
        description: 'Minimal transaction',
        date: '2025-01-01',
      };

      accountRepository.findOne.mockResolvedValue(mockAccount);
      transactionRepository.create.mockReturnValue(mockTransaction);
      transactionRepository.save.mockResolvedValue(mockTransaction);

      await service.create(minimalDto, mockHouseholdId, mockUserId);

      expect(transactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          account_id: mockAccountId,
          amount: 25.50,
          transaction_type: TransactionType.INCOME,
          description: 'Minimal transaction',
          date: new Date('2025-01-01'),
          household_id: mockHouseholdId,
          created_by: mockUserId,
        }),
      );
    });
  });
});
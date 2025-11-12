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
  });
});
import { Test, TestingModule } from '@nestjs/testing';
import { TransactionController } from './transaction.controller';
import { TransactionService, TransactionQueryOptions } from '../services/transaction.service';
import { CreateTransactionDto, UpdateTransactionDto } from '../dto';
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity';
import { User, UserRole } from '../../users/entities/user.entity';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';

describe('TransactionController', () => {
  let controller: TransactionController;
  let service: jest.Mocked<TransactionService>;

  const mockHouseholdId = 'household-123';
  const mockUserId = 'user-123';

  const mockTransaction: Partial<Transaction> = {
    id: 'transaction-123',
    amount: 50.00,
    transaction_type: TransactionType.EXPENSE,
    description: 'Test Transaction',
    status: TransactionStatus.COMPLETED,
    date: new Date('2023-01-01'),
    merchant: 'Test Store',
    account_id: 'account-123',
    category_id: 'category-123',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockUser: Partial<User> = {
    id: mockUserId,
    email: 'test@example.com',
    role: UserRole.HOUSEHOLD_ADMIN,
    household_id: mockHouseholdId,
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      updateStatus: jest.fn(),
      duplicateTransaction: jest.fn(),
      getTransactionSummary: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [
        {
          provide: TransactionService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<TransactionController>(TransactionController);
    service = module.get(TransactionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateTransactionDto = {
      amount: 75.50,
      transaction_type: TransactionType.EXPENSE,
      description: 'New Transaction',
      account_id: 'account-123',
      category_id: 'category-123',
      date: '2023-01-01',
    };

    it('should create a transaction successfully', async () => {
      service.create.mockResolvedValue(mockTransaction as Transaction);

      const result = await controller.create(createDto, mockHouseholdId, mockUser as User);

      expect(service.create).toHaveBeenCalledWith(createDto, mockHouseholdId, mockUserId);
      expect(result).toEqual(mockTransaction);
    });

    it('should handle BadRequestException for invalid data', async () => {
      service.create.mockRejectedValue(new BadRequestException('Account not found'));

      await expect(controller.create(createDto, mockHouseholdId, mockUser as User)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    const mockTransactionsResponse = {
      transactions: [mockTransaction],
      meta: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    };

    it('should return paginated transactions with no filters', async () => {
      service.findAll.mockResolvedValue(mockTransactionsResponse as any);

      const result = await controller.findAll(mockHouseholdId);

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, {
        search: undefined,
        transaction_type: undefined,
        status: undefined,
        category_id: undefined,
        account_id: undefined,
        start_date: undefined,
        end_date: undefined,
        min_amount: undefined,
        max_amount: undefined,
        tags: undefined,
        page: undefined,
        limit: undefined,
      });
      expect(result).toEqual(mockTransactionsResponse);
    });

    it('should return paginated transactions with all filters', async () => {
      service.findAll.mockResolvedValue(mockTransactionsResponse as any);

      const result = await controller.findAll(
        mockHouseholdId,
        'test search',
        TransactionType.EXPENSE,
        TransactionStatus.COMPLETED,
        'category-123',
        'account-123',
        '2023-01-01',
        '2023-12-31',
        10,
        100,
        ['tag1', 'tag2'],
        1,
        10
      );

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, {
        search: 'test search',
        transaction_type: TransactionType.EXPENSE,
        status: TransactionStatus.COMPLETED,
        category_id: 'category-123',
        account_id: 'account-123',
        start_date: '2023-01-01',
        end_date: '2023-12-31',
        min_amount: 10,
        max_amount: 100,
        tags: ['tag1', 'tag2'],
        page: 1,
        limit: 10,
      });
      expect(result).toEqual(mockTransactionsResponse);
    });
  });

  describe('getTransactionSummary', () => {
    const mockSummary = {
      totalTransactions: 50,
      totalIncome: 5000,
      totalExpenses: 3000,
      netAmount: 2000,
      averageTransactionAmount: 60,
      transactionsByType: {
        [TransactionType.EXPENSE]: 30,
        [TransactionType.INCOME]: 20,
        [TransactionType.TRANSFER]: 0,
        [TransactionType.REFUND]: 0,
        [TransactionType.ADJUSTMENT]: 0,
      },
      transactionsByStatus: {
        [TransactionStatus.COMPLETED]: 45,
        [TransactionStatus.PENDING]: 5,
        [TransactionStatus.FAILED]: 0,
        [TransactionStatus.CANCELLED]: 0,
        [TransactionStatus.RECONCILED]: 0,
      },
    };

    it('should return transaction summary without date filters', async () => {
      service.getTransactionSummary.mockResolvedValue(mockSummary);

      const result = await controller.getTransactionSummary(mockHouseholdId);

      expect(service.getTransactionSummary).toHaveBeenCalledWith(mockHouseholdId, undefined, undefined);
      expect(result).toEqual(mockSummary);
    });

    it('should return transaction summary with date filters', async () => {
      service.getTransactionSummary.mockResolvedValue(mockSummary);

      const result = await controller.getTransactionSummary(mockHouseholdId, '2023-01-01', '2023-12-31');

      expect(service.getTransactionSummary).toHaveBeenCalledWith(mockHouseholdId, '2023-01-01', '2023-12-31');
      expect(result).toEqual(mockSummary);
    });
  });

  describe('findOne', () => {
    it('should return a transaction by id', async () => {
      service.findOne.mockResolvedValue(mockTransaction as Transaction);

      const result = await controller.findOne('transaction-123', mockHouseholdId);

      expect(service.findOne).toHaveBeenCalledWith('transaction-123', mockHouseholdId);
      expect(result).toEqual(mockTransaction);
    });

    it('should handle NotFoundException', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Transaction not found'));

      await expect(controller.findOne('nonexistent-id', mockHouseholdId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateTransactionDto = {
      description: 'Updated Transaction',
      amount: 100.00,
      merchant: 'Updated Store',
    };

    it('should update a transaction successfully', async () => {
      const updatedTransaction = { ...mockTransaction, ...updateDto };
      service.update.mockResolvedValue(updatedTransaction as Transaction);

      const result = await controller.update('transaction-123', updateDto, mockHouseholdId, mockUser as User);

      expect(service.update).toHaveBeenCalledWith('transaction-123', mockHouseholdId, updateDto, mockUserId);
      expect(result).toEqual(updatedTransaction);
    });

    it('should handle NotFoundException', async () => {
      service.update.mockRejectedValue(new NotFoundException('Transaction not found'));

      await expect(controller.update('nonexistent-id', updateDto, mockHouseholdId, mockUser as User)).rejects.toThrow(NotFoundException);
    });

    it('should handle BadRequestException for invalid data', async () => {
      service.update.mockRejectedValue(new BadRequestException('Invalid category'));

      await expect(controller.update('transaction-123', updateDto, mockHouseholdId, mockUser as User)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove a transaction successfully', async () => {
      service.remove.mockResolvedValue();

      await controller.remove('transaction-123', mockHouseholdId);

      expect(service.remove).toHaveBeenCalledWith('transaction-123', mockHouseholdId);
    });

    it('should handle NotFoundException', async () => {
      service.remove.mockRejectedValue(new NotFoundException('Transaction not found'));

      await expect(controller.remove('nonexistent-id', mockHouseholdId)).rejects.toThrow(NotFoundException);
    });

    it('should handle ConflictException for reconciled transactions', async () => {
      service.remove.mockRejectedValue(new ConflictException('Cannot delete reconciled transactions'));

      await expect(controller.remove('transaction-123', mockHouseholdId)).rejects.toThrow(ConflictException);
    });
  });

  describe('updateStatus', () => {
    it('should update transaction status successfully', async () => {
      const updatedTransaction = { ...mockTransaction, status: TransactionStatus.FAILED };
      service.updateStatus.mockResolvedValue(updatedTransaction as Transaction);

      const result = await controller.updateStatus('transaction-123', TransactionStatus.FAILED, mockHouseholdId);

      expect(service.updateStatus).toHaveBeenCalledWith('transaction-123', mockHouseholdId, TransactionStatus.FAILED);
      expect(result).toEqual(updatedTransaction);
    });

    it('should handle NotFoundException', async () => {
      service.updateStatus.mockRejectedValue(new NotFoundException('Transaction not found'));

      await expect(controller.updateStatus('nonexistent-id', TransactionStatus.COMPLETED, mockHouseholdId)).rejects.toThrow(NotFoundException);
    });

    it('should handle BadRequestException for invalid status transition', async () => {
      service.updateStatus.mockRejectedValue(new BadRequestException('Invalid status transition'));

      await expect(controller.updateStatus('transaction-123', TransactionStatus.COMPLETED, mockHouseholdId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('duplicateTransaction', () => {
    it('should duplicate transaction successfully', async () => {
      const duplicatedTransaction = { 
        ...mockTransaction, 
        id: 'transaction-duplicate', 
        description: 'Test Transaction (Copy)',
        status: TransactionStatus.PENDING 
      };
      service.duplicateTransaction.mockResolvedValue(duplicatedTransaction as Transaction);

      const result = await controller.duplicateTransaction('transaction-123', mockHouseholdId, mockUser as User);

      expect(service.duplicateTransaction).toHaveBeenCalledWith('transaction-123', mockHouseholdId, mockUserId);
      expect(result).toEqual(duplicatedTransaction);
    });

    it('should handle NotFoundException for original transaction', async () => {
      service.duplicateTransaction.mockRejectedValue(new NotFoundException('Original transaction not found'));

      await expect(controller.duplicateTransaction('nonexistent-id', mockHouseholdId, mockUser as User)).rejects.toThrow(NotFoundException);
    });
  });
});
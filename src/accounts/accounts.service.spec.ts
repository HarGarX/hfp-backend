import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { Account, AccountType, AccountStatus } from './entities/account.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

describe('AccountsService', () => {
  let service: AccountsService;
  let repository: jest.Mocked<Repository<Account>>;

  const mockAccount: Account = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Checking Account',
    account_type: AccountType.CHECKING,
    status: AccountStatus.ACTIVE,
    current_balance: 1000.50,
    available_balance: 950.50,
    currency: 'USD',
    bank_name: 'Test Bank',
    account_number: '****1234',
    routing_number: '123456789',
    is_external: false,
    household_id: '123e4567-e89b-12d3-a456-426614174001',
    created_by: '123e4567-e89b-12d3-a456-426614174002',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  } as Account;

  const mockHouseholdId = '123e4567-e89b-12d3-a456-426614174001';
  const mockUserId = '123e4567-e89b-12d3-a456-426614174002';

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: getRepositoryToken(Account),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    repository = module.get(getRepositoryToken(Account));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createAccountDto: CreateAccountDto = {
      name: 'New Checking Account',
      account_type: AccountType.CHECKING,
      current_balance: 500.00,
      bank_name: 'New Bank',
      account_number: '****5678',
    };

    it('should successfully create an account', async () => {
      repository.findOne.mockResolvedValue(null); // No existing account
      repository.create.mockReturnValue(mockAccount);
      repository.save.mockResolvedValue(mockAccount);

      const result = await service.create(createAccountDto, mockHouseholdId, mockUserId);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { 
          name: createAccountDto.name,
          household_id: mockHouseholdId,
          is_active: true
        }
      });
      expect(repository.create).toHaveBeenCalledWith({
        ...createAccountDto,
        household_id: mockHouseholdId,
        current_balance: 500.00,
        available_balance: 500.00,
        currency: 'USD',
        status: AccountStatus.ACTIVE,
        is_external: false,
        created_by: mockUserId,
      });
      expect(repository.save).toHaveBeenCalledWith(mockAccount);
      expect(result).toEqual(mockAccount);
    });

    it('should throw ConflictException if account name already exists', async () => {
      repository.findOne.mockResolvedValue(mockAccount);

      await expect(service.create(createAccountDto, mockHouseholdId, mockUserId))
        .rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for credit card without credit limit', async () => {
      const creditCardDto = {
        ...createAccountDto,
        account_type: AccountType.CREDIT_CARD,
      };
      repository.findOne.mockResolvedValue(null);

      await expect(service.create(creditCardDto, mockHouseholdId, mockUserId))
        .rejects.toThrow(BadRequestException);
    });

    it('should create credit card account with credit limit', async () => {
      const creditCardDto = {
        ...createAccountDto,
        account_type: AccountType.CREDIT_CARD,
        credit_limit: 5000.00,
      };
      const creditCardAccount = { ...mockAccount, account_type: AccountType.CREDIT_CARD, credit_limit: 5000.00 };
      
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(creditCardAccount);
      repository.save.mockResolvedValue(creditCardAccount);

      const result = await service.create(creditCardDto, mockHouseholdId, mockUserId);

      expect(result).toEqual(creditCardAccount);
    });
  });

  describe('findAll', () => {
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    } as any;

    beforeEach(() => {
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    });

    it('should return paginated accounts', async () => {
      const accounts = [mockAccount];
      const total = 1;
      mockQueryBuilder.getManyAndCount.mockResolvedValue([accounts, total]);

      const result = await service.findAll(mockHouseholdId);

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('account');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('account.household_id = :householdId', { householdId: mockHouseholdId });
      expect(result).toEqual({
        accounts,
        total,
        page: 1,
        totalPages: 1,
      });
    });

    it('should apply search filter', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(mockHouseholdId, { search: 'test' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(account.name ILIKE :search OR account.description ILIKE :search OR account.bank_name ILIKE :search)',
        { search: '%test%' }
      );
    });

    it('should apply account type filter', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(mockHouseholdId, { account_type: AccountType.CHECKING });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'account.account_type = :accountType', 
        { accountType: AccountType.CHECKING }
      );
    });

    it('should calculate correct pagination', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 25]);

      const result = await service.findAll(mockHouseholdId, { page: 2, limit: 10 });

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result.totalPages).toBe(3);
    });
  });

  describe('findOne', () => {
    it('should return account if found', async () => {
      repository.findOne.mockResolvedValue(mockAccount);

      const result = await service.findOne(mockAccount.id, mockHouseholdId);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { 
          id: mockAccount.id, 
          household_id: mockHouseholdId,
          is_active: true
        },
        relations: ['creator'],
      });
      expect(result).toEqual(mockAccount);
    });

    it('should throw NotFoundException if account not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id', mockHouseholdId))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateAccountDto: UpdateAccountDto = {
      name: 'Updated Account Name',
      description: 'Updated description',
    };

    it('should successfully update account', async () => {
      const updatedAccount = { ...mockAccount, ...updateAccountDto } as Account;
      repository.findOne.mockResolvedValueOnce(mockAccount).mockResolvedValueOnce(null); // findOne for existing, then for name conflict
      repository.save.mockResolvedValue(updatedAccount);

      const result = await service.update(mockAccount.id, mockHouseholdId, updateAccountDto, mockUserId);

      expect(result).toEqual(updatedAccount);
      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining(updateAccountDto));
    });

    it('should throw ConflictException if new name already exists', async () => {
      const existingAccount = { ...mockAccount, id: 'different-id', name: 'Existing Account' };
      const updateDto = { name: 'Existing Account' }; // Different from mockAccount.name

      repository.findOne
        .mockResolvedValueOnce(mockAccount) // findOne for account to update
        .mockResolvedValueOnce(existingAccount); // findOne for name conflict check

      await expect(service.update(mockAccount.id, mockHouseholdId, updateDto, mockUserId))
        .rejects.toThrow(ConflictException);
    });

    it('should handle account closure', async () => {
      const closeDto = { status: AccountStatus.CLOSED };
      const today = new Date().toISOString().split('T')[0];
      
      repository.findOne.mockResolvedValue(mockAccount);
      repository.save.mockResolvedValue({ ...mockAccount, ...closeDto });

      await service.update(mockAccount.id, mockHouseholdId, closeDto, mockUserId);

      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
        status: AccountStatus.CLOSED,
        closing_date: today,
      }));
    });
  });

  describe('remove', () => {
    it('should soft delete account', async () => {
      repository.findOne.mockResolvedValue(mockAccount);
      repository.save.mockResolvedValue({ ...mockAccount, is_active: false });

      await service.remove(mockAccount.id, mockHouseholdId);

      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
        is_active: false,
      }));
    });

    it('should throw NotFoundException if account not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent-id', mockHouseholdId))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('updateBalance', () => {
    it('should update account balance', async () => {
      const newBalance = 1500.00;
      const updatedAccount = { 
        ...mockAccount, 
        current_balance: newBalance,
        available_balance: newBalance,
        last_synced_at: new Date(),
      };

      repository.findOne.mockResolvedValue(mockAccount);
      repository.save.mockResolvedValue(updatedAccount);

      const result = await service.updateBalance(mockAccount.id, mockHouseholdId, newBalance);

      expect(result.current_balance).toBe(newBalance);
      expect(result.available_balance).toBe(newBalance);
      expect(result.last_synced_at).toBeInstanceOf(Date);
    });

    it('should update both current and available balance separately', async () => {
      const currentBalance = 1500.00;
      const availableBalance = 1400.00;

      repository.findOne.mockResolvedValue(mockAccount);
      repository.save.mockResolvedValue({ 
        ...mockAccount, 
        current_balance: currentBalance,
        available_balance: availableBalance,
      });

      const result = await service.updateBalance(mockAccount.id, mockHouseholdId, currentBalance, availableBalance);

      expect(result.current_balance).toBe(currentBalance);
      expect(result.available_balance).toBe(availableBalance);
    });
  });

  describe('getAccountSummary', () => {
    it('should return account summary', async () => {
      const accounts = [
        { ...mockAccount, account_type: AccountType.CHECKING, current_balance: 1000 },
        { ...mockAccount, id: 'different-id', account_type: AccountType.SAVINGS, current_balance: 2000 },
        { ...mockAccount, id: 'another-id', account_type: AccountType.CHECKING, current_balance: 500, currency: 'EUR' },
      ];
      repository.find.mockResolvedValue(accounts);

      const result = await service.getAccountSummary(mockHouseholdId);

      expect(result).toEqual({
        total_accounts: 3,
        total_balance: 3500,
        accounts_by_type: {
          [AccountType.CHECKING]: 2,
          [AccountType.SAVINGS]: 1,
        },
        accounts_by_currency: {
          'USD': 3000,
          'EUR': 500,
        },
      });
    });
  });

  describe('account status operations', () => {
    it('should activate account', async () => {
      repository.findOne.mockResolvedValue(mockAccount);
      repository.save.mockResolvedValue({ ...mockAccount, status: AccountStatus.ACTIVE });

      const result = await service.activateAccount(mockAccount.id, mockHouseholdId);

      expect(result.status).toBe(AccountStatus.ACTIVE);
    });

    it('should close account', async () => {
      const closedDate = new Date();
      repository.findOne.mockResolvedValue(mockAccount);
      repository.save.mockResolvedValue({ 
        ...mockAccount, 
        status: AccountStatus.CLOSED,
        closing_date: closedDate,
      });

      const result = await service.closeAccount(mockAccount.id, mockHouseholdId);

      expect(result.status).toBe(AccountStatus.CLOSED);
      expect(result.closing_date).toEqual(closedDate);
    });

    it('should suspend account', async () => {
      repository.findOne.mockResolvedValue(mockAccount);
      repository.save.mockResolvedValue({ ...mockAccount, status: AccountStatus.SUSPENDED });

      const result = await service.suspendAccount(mockAccount.id, mockHouseholdId);

      expect(result.status).toBe(AccountStatus.SUSPENDED);
    });
  });
});
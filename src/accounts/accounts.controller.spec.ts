import { Test, TestingModule } from '@nestjs/testing';
import { AccountsController } from './accounts.controller';
import { AccountsService, AccountSummary } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UpdateBalanceDto } from './dto/update-balance.dto';
import { Account, AccountType, AccountStatus } from './entities/account.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';

describe('AccountsController', () => {
  let controller: AccountsController;
  let service: jest.Mocked<AccountsService>;

  const mockHouseholdId = 'household-123';
  const mockUserId = 'user-123';

  const mockAccount: Partial<Account> = {
    id: 'account-123',
    name: 'Test Account',
    account_type: AccountType.CHECKING,
    current_balance: 1000,
    available_balance: 950,
    status: AccountStatus.ACTIVE,
    bank_name: 'Test Bank',
    currency: 'USD',
    is_external: false,
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
      updateBalance: jest.fn(),
      getAccountSummary: jest.fn(),
      activateAccount: jest.fn(),
      closeAccount: jest.fn(),
      suspendAccount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        {
          provide: AccountsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<AccountsController>(AccountsController);
    service = module.get(AccountsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateAccountDto = {
      name: 'New Account',
      account_type: AccountType.CHECKING,
      current_balance: 500,
      bank_name: 'New Bank',
    };

    it('should create an account successfully', async () => {
      service.create.mockResolvedValue(mockAccount as Account);

      const result = await controller.create(createDto, mockHouseholdId, mockUser as User);

      expect(service.create).toHaveBeenCalledWith(createDto, mockHouseholdId, mockUserId);
      expect(result).toEqual(mockAccount);
    });

    it('should handle BadRequestException', async () => {
      service.create.mockRejectedValue(new BadRequestException('Invalid account data'));

      await expect(controller.create(createDto, mockHouseholdId, mockUser as User)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    const mockAccounts = {
      accounts: [mockAccount],
      meta: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    };

    it('should return paginated accounts with no filters', async () => {
      service.findAll.mockResolvedValue(mockAccounts as any);

      const result = await controller.findAll(mockHouseholdId);

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, {
        search: undefined,
        account_type: undefined,
        status: undefined,
        currency: undefined,
        is_external: undefined,
        page: undefined,
        limit: undefined,
      });
      expect(result).toEqual(mockAccounts);
    });

    it('should return paginated accounts with filters', async () => {
      service.findAll.mockResolvedValue(mockAccounts as any);

      const result = await controller.findAll(
        mockHouseholdId,
        'test',
        AccountType.CHECKING,
        AccountStatus.ACTIVE,
        'USD',
        false,
        1,
        10
      );

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, {
        search: 'test',
        account_type: AccountType.CHECKING,
        status: AccountStatus.ACTIVE,
        currency: 'USD',
        is_external: false,
        page: 1,
        limit: 10,
      });
      expect(result).toEqual(mockAccounts);
    });
  });

  describe('getAccountSummary', () => {
    const mockSummary: AccountSummary = {
      total_accounts: 3,
      total_balance: 5000,
      accounts_by_type: {
        [AccountType.CHECKING]: 2000,
        [AccountType.SAVINGS]: 2000,
        [AccountType.CREDIT_CARD]: 1000,
        [AccountType.INVESTMENT]: 0,
        [AccountType.CASH]: 0,
        [AccountType.LOAN]: 0,
        [AccountType.BUSINESS]: 0,
        [AccountType.OTHER]: 0,
      },
      accounts_by_currency: {
        'USD': 5000,
      },
    };

    it('should return account summary', async () => {
      service.getAccountSummary.mockResolvedValue(mockSummary);

      const result = await controller.getAccountSummary(mockHouseholdId);

      expect(service.getAccountSummary).toHaveBeenCalledWith(mockHouseholdId);
      expect(result).toEqual(mockSummary);
    });
  });

  describe('findOne', () => {
    it('should return an account by id', async () => {
      service.findOne.mockResolvedValue(mockAccount as Account);

      const result = await controller.findOne('account-123', mockHouseholdId);

      expect(service.findOne).toHaveBeenCalledWith('account-123', mockHouseholdId);
      expect(result).toEqual(mockAccount);
    });

    it('should handle NotFoundException', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Account not found'));

      await expect(controller.findOne('nonexistent-id', mockHouseholdId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateAccountDto = {
      name: 'Updated Account',
      bank_name: 'Updated Bank',
    };

    it('should update an account successfully', async () => {
      const updatedAccount = { ...mockAccount, ...updateDto };
      service.update.mockResolvedValue(updatedAccount as Account);

      const result = await controller.update('account-123', updateDto, mockHouseholdId, mockUser as User);

      expect(service.update).toHaveBeenCalledWith('account-123', mockHouseholdId, updateDto, mockUserId);
      expect(result).toEqual(updatedAccount);
    });

    it('should handle NotFoundException', async () => {
      service.update.mockRejectedValue(new NotFoundException('Account not found'));

      await expect(controller.update('nonexistent-id', updateDto, mockHouseholdId, mockUser as User)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove an account successfully', async () => {
      service.remove.mockResolvedValue();

      await controller.remove('account-123', mockHouseholdId);

      expect(service.remove).toHaveBeenCalledWith('account-123', mockHouseholdId);
    });

    it('should handle NotFoundException', async () => {
      service.remove.mockRejectedValue(new NotFoundException('Account not found'));

      await expect(controller.remove('nonexistent-id', mockHouseholdId)).rejects.toThrow(NotFoundException);
    });

    it('should handle ConflictException when account has active transactions', async () => {
      service.remove.mockRejectedValue(new ConflictException('Cannot delete account with active transactions'));

      await expect(controller.remove('account-123', mockHouseholdId)).rejects.toThrow(ConflictException);
    });
  });

  describe('updateBalance', () => {
    const updateBalanceDto: UpdateBalanceDto = {
      current_balance: 1500,
      available_balance: 1450,
    };

    it('should update account balance successfully', async () => {
      const updatedAccount = { 
        ...mockAccount, 
        current_balance: updateBalanceDto.current_balance,
        available_balance: updateBalanceDto.available_balance 
      };
      service.updateBalance.mockResolvedValue(updatedAccount as Account);

      const result = await controller.updateBalance('account-123', mockHouseholdId, updateBalanceDto);

      expect(service.updateBalance).toHaveBeenCalledWith(
        'account-123', 
        mockHouseholdId, 
        updateBalanceDto.current_balance,
        updateBalanceDto.available_balance
      );
      expect(result).toEqual(updatedAccount);
    });

    it('should handle NotFoundException', async () => {
      service.updateBalance.mockRejectedValue(new NotFoundException('Account not found'));

      await expect(controller.updateBalance('nonexistent-id', mockHouseholdId, updateBalanceDto)).rejects.toThrow(NotFoundException);
    });

    it('should handle BadRequestException for invalid balance data', async () => {
      service.updateBalance.mockRejectedValue(new BadRequestException('Available balance cannot exceed current balance'));

      await expect(controller.updateBalance('account-123', mockHouseholdId, updateBalanceDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('activateAccount', () => {
    it('should activate account successfully', async () => {
      const activeAccount = { ...mockAccount, status: AccountStatus.ACTIVE };
      service.activateAccount.mockResolvedValue(activeAccount as Account);

      const result = await controller.activateAccount('account-123', mockHouseholdId);

      expect(service.activateAccount).toHaveBeenCalledWith('account-123', mockHouseholdId);
      expect(result).toEqual(activeAccount);
    });

    it('should handle NotFoundException', async () => {
      service.activateAccount.mockRejectedValue(new NotFoundException('Account not found'));

      await expect(controller.activateAccount('nonexistent-id', mockHouseholdId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('closeAccount', () => {
    it('should close account successfully', async () => {
      const closedAccount = { ...mockAccount, status: AccountStatus.CLOSED };
      service.closeAccount.mockResolvedValue(closedAccount as Account);

      const result = await controller.closeAccount('account-123', mockHouseholdId);

      expect(service.closeAccount).toHaveBeenCalledWith('account-123', mockHouseholdId);
      expect(result).toEqual(closedAccount);
    });

    it('should handle NotFoundException', async () => {
      service.closeAccount.mockRejectedValue(new NotFoundException('Account not found'));

      await expect(controller.closeAccount('nonexistent-id', mockHouseholdId)).rejects.toThrow(NotFoundException);
    });

    it('should handle ConflictException when account has outstanding balance', async () => {
      service.closeAccount.mockRejectedValue(new ConflictException('Cannot close account with outstanding balance'));

      await expect(controller.closeAccount('account-123', mockHouseholdId)).rejects.toThrow(ConflictException);
    });
  });

  describe('suspendAccount', () => {
    it('should suspend account successfully', async () => {
      const suspendedAccount = { ...mockAccount, status: AccountStatus.SUSPENDED };
      service.suspendAccount.mockResolvedValue(suspendedAccount as Account);

      const result = await controller.suspendAccount('account-123', mockHouseholdId);

      expect(service.suspendAccount).toHaveBeenCalledWith('account-123', mockHouseholdId);
      expect(result).toEqual(suspendedAccount);
    });

    it('should handle NotFoundException', async () => {
      service.suspendAccount.mockRejectedValue(new NotFoundException('Account not found'));

      await expect(controller.suspendAccount('nonexistent-id', mockHouseholdId)).rejects.toThrow(NotFoundException);
    });
  });
});
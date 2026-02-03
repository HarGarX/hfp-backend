import { 
  Injectable, 
  NotFoundException, 
  ForbiddenException, 
  ConflictException,
  BadRequestException 
} from '@nestjs/common';
import { CacheService } from '../../libs/cache';
import { Account, AccountType, AccountStatus } from './entities/account.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountsRepository } from './repositories/accounts.repository';

export interface AccountQueryOptions {
  search?: string;
  account_type?: AccountType;
  status?: AccountStatus;
  currency?: string;
  is_external?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedAccounts {
  accounts: Account[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AccountSummary {
  total_accounts: number;
  total_balance: number;
  accounts_by_type: Record<AccountType, number>;
  accounts_by_currency: Record<string, number>;
}

@Injectable()
export class AccountsService {
  private readonly CACHE_TTL = 300; // 5 minutes
  
  constructor(
    private accountsRepository: AccountsRepository,
    private cacheService: CacheService,
  ) {}

  async create(
    createAccountDto: CreateAccountDto, 
    householdId: string,
    userId?: string
  ): Promise<Account> {
    // Check for duplicate account name within household
    const existingAccount = await this.accountsRepository.findOneWithHousehold(householdId, {
      where: { 
        name: createAccountDto.name,
        is_active: true
      }
    });

    if (existingAccount) {
      throw new ConflictException('Account with this name already exists in your household');
    }

    // Set default values for balances if not provided
    const currentBalance = createAccountDto.current_balance ?? 0;
    const availableBalance = createAccountDto.available_balance ?? currentBalance;

    // Business logic validation
    if (createAccountDto.account_type === AccountType.CREDIT_CARD && !createAccountDto.credit_limit) {
      throw new BadRequestException('Credit limit is required for credit card accounts');
    }

    const account = this.accountsRepository.create({
      ...createAccountDto,
      household_id: householdId,
      current_balance: currentBalance,
      available_balance: availableBalance,
      currency: createAccountDto.currency || 'USD',
      status: createAccountDto.status || AccountStatus.ACTIVE,
      is_external: createAccountDto.is_external || false,
      created_by: userId,
    });

    const savedAccount = await this.accountsRepository.saveWithHousehold(householdId, account);
    
    // Invalidate accounts list cache
    await this.cacheService.del(householdId, 'accounts:list');
    await this.cacheService.del(householdId, 'accounts:summary');
    
    return savedAccount;
  }

  async findAll(
    householdId: string,
    options: AccountQueryOptions = {}
  ): Promise<PaginatedAccounts> {
    const { 
      search, 
      account_type, 
      status, 
      currency,
      is_external,
      page = 1, 
      limit = 10 
    } = options;
    
    const queryBuilder = this.accountsRepository.createQueryBuilderWithHousehold(householdId, 'account')
      .andWhere('account.is_active = :isActive', { isActive: true });
    
    // Add search functionality
    if (search) {
      queryBuilder.andWhere(
        '(account.name ILIKE :search OR account.description ILIKE :search OR account.bank_name ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Filter by account type
    if (account_type) {
      queryBuilder.andWhere('account.account_type = :accountType', { accountType: account_type });
    }

    // Filter by status
    if (status) {
      queryBuilder.andWhere('account.status = :status', { status });
    }

    // Filter by currency
    if (currency) {
      queryBuilder.andWhere('account.currency = :currency', { currency });
    }

    // Filter by external status
    if (is_external !== undefined) {
      queryBuilder.andWhere('account.is_external = :isExternal', { isExternal: is_external });
    }

    // Add pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Order by created date desc
    queryBuilder.orderBy('account.created_at', 'DESC');

    // Load relations
    queryBuilder.leftJoinAndSelect('account.creator', 'creator');

    const [accounts, total] = await queryBuilder.getManyAndCount();

    return {
      accounts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, householdId: string): Promise<Account> {
    // Try cache first
    const cacheKey = `accounts:${id}`;
    const cached = await this.cacheService.get<Account>(householdId, cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const account = await this.accountsRepository.findOneWithHousehold(householdId, {
      where: { 
        id,
        is_active: true
      },
      relations: ['creator'],
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    // Cache the account
    await this.cacheService.set(householdId, cacheKey, account, this.CACHE_TTL);

    return account;
  }

  async update(
    id: string, 
    householdId: string,
    updateAccountDto: UpdateAccountDto,
    userId?: string
  ): Promise<Account> {
    const account = await this.findOne(id, householdId);

    // Check for name conflict if updating name
    if (updateAccountDto.name && updateAccountDto.name !== account.name) {
      const existingAccount = await this.accountsRepository.findOneWithHousehold(householdId, {
        where: { 
          name: updateAccountDto.name,
          is_active: true
        }
      });

      if (existingAccount) {
        throw new ConflictException('Account with this name already exists in your household');
      }
    }

    // Prevent changing account type for existing accounts with transactions
    // (In a full implementation, you'd check for existing transactions)
    
    // Handle account closure
    if (updateAccountDto.status === AccountStatus.CLOSED) {
      if (!updateAccountDto.closing_date) {
        updateAccountDto.closing_date = new Date().toISOString().split('T')[0];
      }
    }

    // Update account
    Object.assign(account, updateAccountDto);
    
    const updatedAccount = await this.accountsRepository.saveWithHousehold(householdId, account);
    
    // Invalidate caches
    await this.cacheService.del(householdId, `accounts:${id}`);
    await this.cacheService.del(householdId, 'accounts:list');
    await this.cacheService.del(householdId, 'accounts:summary');
    
    return updatedAccount;
  }

  async remove(id: string, householdId: string): Promise<void> {
    const account = await this.findOne(id, householdId);

    // Soft delete
    account.is_active = false;
    await this.accountsRepository.saveWithHousehold(householdId, account);
    
    // Invalidate caches
    await this.cacheService.del(householdId, `accounts:${id}`);
    await this.cacheService.del(householdId, 'accounts:list');
    await this.cacheService.del(householdId, 'accounts:summary');
  }

  async updateBalance(
    id: string, 
    householdId: string,
    currentBalance: number,
    availableBalance?: number
  ): Promise<Account> {
    const account = await this.findOne(id, householdId);

    account.current_balance = currentBalance;
    account.available_balance = availableBalance ?? currentBalance;
    account.last_synced_at = new Date();

    const updatedAccount = await this.accountsRepository.saveWithHousehold(householdId, account);
    
    // Invalidate caches
    await this.cacheService.del(householdId, `accounts:${id}`);
    await this.cacheService.del(householdId, 'accounts:summary');
    
    return updatedAccount;
  }

  async getAccountSummary(householdId: string): Promise<AccountSummary> {
    // Try cache first
    const cacheKey = 'accounts:summary';
    const cached = await this.cacheService.get<AccountSummary>(householdId, cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const accounts = await this.accountsRepository.findWithHousehold(householdId, {
      where: { 
        is_active: true,
        status: AccountStatus.ACTIVE
      }
    });

    const totalBalance = accounts.reduce((sum, account) => sum + Number(account.current_balance), 0);
    
    const accountsByType = accounts.reduce((acc, account) => {
      acc[account.account_type] = (acc[account.account_type] || 0) + 1;
      return acc;
    }, {} as Record<AccountType, number>);

    const accountsByCurrency = accounts.reduce((acc, account) => {
      acc[account.currency] = (acc[account.currency] || 0) + Number(account.current_balance);
      return acc;
    }, {} as Record<string, number>);

    const summary = {
      total_accounts: accounts.length,
      total_balance: totalBalance,
      accounts_by_type: accountsByType,
      accounts_by_currency: accountsByCurrency,
    };
    
    // Cache the summary
    await this.cacheService.set(householdId, cacheKey, summary, this.CACHE_TTL);
    
    return summary;
  }

  async activateAccount(id: string, householdId: string): Promise<Account> {
    const account = await this.findOne(id, householdId);
    account.status = AccountStatus.ACTIVE;
    return this.accountsRepository.saveWithHousehold(householdId, account);
  }

  async closeAccount(id: string, householdId: string): Promise<Account> {
    const account = await this.findOne(id, householdId);
    account.status = AccountStatus.CLOSED;
    account.closing_date = new Date();
    return this.accountsRepository.saveWithHousehold(householdId, account);
  }

  async suspendAccount(id: string, householdId: string): Promise<Account> {
    const account = await this.findOne(id, householdId);
    account.status = AccountStatus.SUSPENDED;
    return this.accountsRepository.saveWithHousehold(householdId, account);
  }
}
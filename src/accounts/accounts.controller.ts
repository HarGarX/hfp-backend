import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantContextInterceptor } from '../shared/interceptors/tenant-context.interceptor';
import { HouseholdGuard } from '../shared/guards/household.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { HouseholdThrottlerGuard } from '../../libs/throttle';
import { AuditLog, AuditAction } from '../../libs/logger';
import { RequireRole } from '../auth/decorators/roles.decorator';
import { CurrentHousehold } from '../shared/decorators/current-household.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { AccountsService, AccountQueryOptions } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UpdateBalanceDto } from './dto/update-balance.dto';
import { Account, AccountType, AccountStatus } from './entities/account.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HouseholdGuard, RolesGuard, HouseholdThrottlerGuard)
@UseInterceptors(TenantContextInterceptor)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @AuditLog(AuditAction.CREATE, 'account')
  @ApiOperation({
    summary: 'Create a new financial account',
    description: 'Create a new financial account for the household. Supports various account types including checking, savings, credit cards, and investments.'
  })
  @ApiCreatedResponse({
    description: 'Account created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        account_type: { type: 'string', enum: ['checking', 'savings', 'credit_card', 'investment', 'cash', 'loan', 'business', 'other'] },
        current_balance: { type: 'string' },
        available_balance: { type: 'string' },
        status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'CLOSED', 'SUSPENDED'] },
        created_at: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid account data or credit card without credit limit' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  create(
    @Body() createAccountDto: CreateAccountDto,
    @CurrentHousehold() householdId: string,
    @CurrentUser() user: User,
  ): Promise<Account> {
    return this.accountsService.create(createAccountDto, householdId, user.id);
  }

  @Get()
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({
    summary: 'Get household accounts',
    description: 'Retrieve a filtered and paginated list of accounts for the current household.'
  })
  @ApiQuery({ name: 'search', required: false, description: 'Search by account name or bank name' })
  @ApiQuery({ name: 'account_type', required: false, enum: AccountType, description: 'Filter by account type' })
  @ApiQuery({ name: 'status', required: false, enum: AccountStatus, description: 'Filter by account status' })
  @ApiQuery({ name: 'currency', required: false, description: 'Filter by currency code' })
  @ApiQuery({ name: 'is_external', required: false, type: Boolean, description: 'Filter by external/internal accounts' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @ApiOkResponse({
    description: 'Accounts retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        accounts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              account_type: { type: 'string' },
              current_balance: { type: 'string' },
              available_balance: { type: 'string' },
              status: { type: 'string' },
              bank_name: { type: 'string' }
            }
          }
        },
        meta: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' }
          }
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  findAll(
    @CurrentHousehold() householdId: string,
    @Query('search') search?: string,
    @Query('account_type') account_type?: AccountType,
    @Query('status') status?: AccountStatus,
    @Query('currency') currency?: string,
    @Query('is_external') is_external?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const options: AccountQueryOptions = {
      search,
      account_type,
      status,
      currency,
      is_external,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    };
    
    return this.accountsService.findAll(householdId, options);
  }

  @Get('summary')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({
    summary: 'Get account summary',
    description: 'Get aggregated financial summary including total balances by account type and overall household finances.'
  })
  @ApiOkResponse({
    description: 'Account summary retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalBalance: { type: 'number', description: 'Total balance across all accounts' },
        totalAvailableBalance: { type: 'number', description: 'Total available balance' },
        accountsByType: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              count: { type: 'number' },
              totalBalance: { type: 'number' },
              averageBalance: { type: 'number' }
            }
          }
        },
        totalAccounts: { type: 'number', description: 'Total number of accounts' }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  getAccountSummary(@CurrentHousehold() householdId: string) {
    return this.accountsService.getAccountSummary(householdId);
  }

  @Get(':id')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({
    summary: 'Get account details',
    description: 'Retrieve detailed information for a specific account including balance history and metadata.'
  })
  @ApiParam({ name: 'id', description: 'Account UUID' })
  @ApiOkResponse({
    description: 'Account details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        account_type: { type: 'string' },
        current_balance: { type: 'string' },
        available_balance: { type: 'string' },
        credit_limit: { type: 'number', nullable: true },
        status: { type: 'string' },
        bank_name: { type: 'string', nullable: true },
        account_number: { type: 'string', nullable: true },
        routing_number: { type: 'string', nullable: true },
        is_external: { type: 'boolean' },
        currency: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiNotFoundResponse({ description: 'Account not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentHousehold() householdId: string,
  ): Promise<Account> {
    return this.accountsService.findOne(id, householdId);
  }

  @Patch(':id')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAccountDto: UpdateAccountDto,
    @CurrentHousehold() householdId: string,
    @CurrentUser() user: User,
  ): Promise<Account> {
    return this.accountsService.update(id, householdId, updateAccountDto, user.id);
  }

  @Delete(':id')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentHousehold() householdId: string,
  ): Promise<void> {
    return this.accountsService.remove(id, householdId);
  }

  @Patch(':id/balance')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @ApiOperation({
    summary: 'Update account balance',
    description: 'Update the current and available balance for an account. Used for manual balance corrections or external sync.'
  })
  @ApiParam({ name: 'id', description: 'Account UUID' })
  @ApiOkResponse({
    description: 'Account balance updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        current_balance: { type: 'string' },
        available_balance: { type: 'string' },
        updated_at: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid balance data' })
  @ApiNotFoundResponse({ description: 'Account not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  updateBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentHousehold() householdId: string,
    @Body() updateBalanceDto: UpdateBalanceDto,
  ): Promise<Account> {
    return this.accountsService.updateBalance(
      id, 
      householdId, 
      updateBalanceDto.current_balance, 
      updateBalanceDto.available_balance
    );
  }

  @Patch(':id/activate')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  activateAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentHousehold() householdId: string,
  ): Promise<Account> {
    return this.accountsService.activateAccount(id, householdId);
  }

  @Patch(':id/close')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  closeAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentHousehold() householdId: string,
  ): Promise<Account> {
    return this.accountsService.closeAccount(id, householdId);
  }

  @Patch(':id/suspend')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN)
  suspendAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentHousehold() householdId: string,
  ): Promise<Account> {
    return this.accountsService.suspendAccount(id, householdId);
  }
}
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
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { HouseholdGuard } from '../../shared/guards/household.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { RequireRole } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentHousehold } from '../../shared/decorators/current-household.decorator';
import { User, UserRole } from '../../users/entities/user.entity';
import { TransactionService, TransactionQueryOptions } from '../services/transaction.service';
import { CreateTransactionDto, UpdateTransactionDto } from '../dto';
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity';

@ApiTags('Transactions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, HouseholdGuard, RolesGuard)
@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @ApiOperation({
    summary: 'Create a new transaction',
    description: 'Create a new transaction (expense, income, transfer, etc.) for the household.'
  })
  @ApiCreatedResponse({
    description: 'Transaction created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        amount: { type: 'number' },
        transaction_type: { type: 'string', enum: ['expense', 'income', 'transfer', 'refund', 'adjustment'] },
        description: { type: 'string' },
        date: { type: 'string', format: 'date' },
        status: { type: 'string', enum: ['pending', 'completed', 'failed', 'cancelled', 'reconciled'] },
        created_at: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid transaction data or account not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  create(
    @Body() createTransactionDto: CreateTransactionDto,
    @CurrentHousehold() householdId: string,
    @CurrentUser() user: User,
  ): Promise<Transaction> {
    return this.transactionService.create(createTransactionDto, householdId, user.id);
  }

  @Get()
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({
    summary: 'Get household transactions',
    description: 'Retrieve a filtered and paginated list of transactions for the current household.'
  })
  @ApiQuery({ name: 'search', required: false, description: 'Search by description, merchant, or notes' })
  @ApiQuery({ name: 'transaction_type', required: false, enum: TransactionType, description: 'Filter by transaction type' })
  @ApiQuery({ name: 'status', required: false, enum: TransactionStatus, description: 'Filter by transaction status' })
  @ApiQuery({ name: 'category_id', required: false, description: 'Filter by category ID' })
  @ApiQuery({ name: 'account_id', required: false, description: 'Filter by account ID' })
  @ApiQuery({ name: 'start_date', required: false, description: 'Start date filter (YYYY-MM-DD)' })
  @ApiQuery({ name: 'end_date', required: false, description: 'End date filter (YYYY-MM-DD)' })
  @ApiQuery({ name: 'min_amount', required: false, type: Number, description: 'Minimum amount filter' })
  @ApiQuery({ name: 'max_amount', required: false, type: Number, description: 'Maximum amount filter' })
  @ApiQuery({ name: 'tags', required: false, type: [String], description: 'Filter by tags' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @ApiOkResponse({
    description: 'Transactions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        transactions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              amount: { type: 'number' },
              transaction_type: { type: 'string' },
              description: { type: 'string' },
              date: { type: 'string', format: 'date' },
              status: { type: 'string' },
              merchant: { type: 'string' },
              account: { type: 'object' },
              category: { type: 'object' }
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
    @Query('transaction_type') transaction_type?: TransactionType,
    @Query('status') status?: TransactionStatus,
    @Query('category_id') category_id?: string,
    @Query('account_id') account_id?: string,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
    @Query('min_amount') min_amount?: number,
    @Query('max_amount') max_amount?: number,
    @Query('tags') tags?: string[],
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const options: TransactionQueryOptions = {
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
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    };
    
    return this.transactionService.findAll(householdId, options);
  }

  @Get('summary')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({
    summary: 'Get transaction summary',
    description: 'Get aggregated transaction summary including totals, averages, and breakdowns by type and status.'
  })
  @ApiQuery({ name: 'start_date', required: false, description: 'Start date for summary (YYYY-MM-DD)' })
  @ApiQuery({ name: 'end_date', required: false, description: 'End date for summary (YYYY-MM-DD)' })
  @ApiOkResponse({
    description: 'Transaction summary retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalTransactions: { type: 'number' },
        totalIncome: { type: 'number' },
        totalExpenses: { type: 'number' },
        netAmount: { type: 'number' },
        averageTransactionAmount: { type: 'number' },
        transactionsByType: {
          type: 'object',
          additionalProperties: { type: 'number' }
        },
        transactionsByStatus: {
          type: 'object',
          additionalProperties: { type: 'number' }
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  getTransactionSummary(
    @CurrentHousehold() householdId: string,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
  ) {
    return this.transactionService.getTransactionSummary(householdId, start_date, end_date);
  }

  @Get(':id')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({
    summary: 'Get transaction details',
    description: 'Retrieve detailed information for a specific transaction including account and category details.'
  })
  @ApiParam({ name: 'id', description: 'Transaction UUID' })
  @ApiOkResponse({
    description: 'Transaction details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        amount: { type: 'number' },
        transaction_type: { type: 'string' },
        description: { type: 'string' },
        notes: { type: 'string' },
        date: { type: 'string', format: 'date' },
        status: { type: 'string' },
        merchant: { type: 'string' },
        reference_number: { type: 'string' },
        is_recurring: { type: 'boolean' },
        tags: { type: 'array', items: { type: 'string' } },
        account: { type: 'object' },
        category: { type: 'object' },
        transfer_account: { type: 'object' },
        metadata: { type: 'object' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiNotFoundResponse({ description: 'Transaction not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentHousehold() householdId: string,
  ): Promise<Transaction> {
    return this.transactionService.findOne(id, householdId);
  }

  @Patch(':id')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @ApiOperation({
    summary: 'Update transaction',
    description: 'Update transaction details. Only users with appropriate permissions can update transactions.'
  })
  @ApiParam({ name: 'id', description: 'Transaction UUID' })
  @ApiOkResponse({
    description: 'Transaction updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        amount: { type: 'number' },
        transaction_type: { type: 'string' },
        description: { type: 'string' },
        updated_at: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid update data' })
  @ApiNotFoundResponse({ description: 'Transaction not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
    @CurrentHousehold() householdId: string,
    @CurrentUser() user: User,
  ): Promise<Transaction> {
    return this.transactionService.update(id, householdId, updateTransactionDto, user.id);
  }

  @Delete(':id')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete transaction',
    description: 'Soft delete a transaction. This action can be reversed by administrators.'
  })
  @ApiParam({ name: 'id', description: 'Transaction UUID' })
  @ApiNoContentResponse({ description: 'Transaction deleted successfully' })
  @ApiNotFoundResponse({ description: 'Transaction not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentHousehold() householdId: string,
  ): Promise<void> {
    return this.transactionService.remove(id, householdId);
  }

  @Patch(':id/status')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @ApiOperation({
    summary: 'Update transaction status',
    description: 'Update the status of a transaction (pending, completed, failed, etc.)'
  })
  @ApiParam({ name: 'id', description: 'Transaction UUID' })
  @ApiOkResponse({
    description: 'Transaction status updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string' },
        updated_at: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiNotFoundResponse({ description: 'Transaction not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: TransactionStatus,
    @CurrentHousehold() householdId: string,
  ): Promise<Transaction> {
    return this.transactionService.updateStatus(id, householdId, status);
  }

  @Post(':id/duplicate')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @ApiOperation({
    summary: 'Duplicate transaction',
    description: 'Create a copy of an existing transaction with pending status.'
  })
  @ApiParam({ name: 'id', description: 'Transaction UUID to duplicate' })
  @ApiCreatedResponse({
    description: 'Transaction duplicated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        description: { type: 'string', description: 'Will include "(Copy)" suffix' },
        status: { type: 'string', enum: ['pending'] },
        created_at: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiNotFoundResponse({ description: 'Original transaction not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  duplicateTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentHousehold() householdId: string,
    @CurrentUser() user: User,
  ): Promise<Transaction> {
    return this.transactionService.duplicateTransaction(id, householdId, user.id);
  }
}
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
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
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
import { TenantContextInterceptor } from '../../shared/interceptors/tenant-context.interceptor';
import { HouseholdGuard } from '../../shared/guards/household.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { RequireRole } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentHousehold } from '../../shared/decorators/current-household.decorator';
import { User, UserRole } from '../../users/entities/user.entity';
import { GoalsService, GoalQueryOptions } from '../services/goals.service';
import { CreateGoalDto, UpdateGoalDto, GoalContributionDto, GoalWithdrawalDto } from '../dto';
import { Goal, GoalType, GoalStatus, GoalPriority } from '../entities/goal.entity';

@ApiTags('Goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HouseholdGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @ApiOperation({
    summary: 'Create a new financial goal',
    description: 'Create a new financial goal with target amount and date. Supports automatic contributions.',
  })
  @ApiCreatedResponse({
    description: 'Goal created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        goal_type: { type: 'string', enum: Object.values(GoalType) },
        target_amount: { type: 'number' },
        current_amount: { type: 'number' },
        target_date: { type: 'string', format: 'date-time' },
        status: { type: 'string', enum: Object.values(GoalStatus) },
        priority: { type: 'string', enum: Object.values(GoalPriority) },
        progress_percentage: { type: 'number' },
        days_remaining: { type: 'number' },
        created_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid goal data or target date in the past' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  create(
    @Body() createGoalDto: CreateGoalDto,
    @CurrentHousehold() householdId: string,
    @CurrentUser() user: User,
  ): Promise<Goal> {
    return this.goalsService.create(createGoalDto, householdId, user.id);
  }

  @Get()
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({
    summary: 'Get household goals',
    description: 'Retrieve a paginated list of household financial goals with filtering and search options.',
  })
  @ApiQuery({ name: 'search', required: false, description: 'Search in goal name and description' })
  @ApiQuery({ name: 'goal_type', required: false, description: 'Filter by goal type', enum: GoalType })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by goal status', enum: GoalStatus })
  @ApiQuery({ name: 'priority', required: false, description: 'Filter by priority level', enum: GoalPriority })
  @ApiQuery({ name: 'created_by', required: false, description: 'Filter by creator user ID' })
  @ApiQuery({ name: 'due_soon', required: false, description: 'Filter goals due within 30 days', type: 'boolean' })
  @ApiQuery({ name: 'overdue', required: false, description: 'Filter overdue goals', type: 'boolean' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 50 })
  @ApiOkResponse({
    description: 'Goals retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        goals: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              goal_type: { type: 'string' },
              target_amount: { type: 'number' },
              current_amount: { type: 'number' },
              target_date: { type: 'string', format: 'date-time' },
              status: { type: 'string' },
              priority: { type: 'string' },
              progress_percentage: { type: 'number' },
              days_remaining: { type: 'number' },
              creator: { type: 'object' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  findAll(
    @CurrentHousehold() householdId: string,
    @Query('search') search?: string,
    @Query('goal_type') goal_type?: GoalType,
    @Query('status') status?: GoalStatus,
    @Query('priority') priority?: GoalPriority,
    @Query('created_by') created_by?: string,
    @Query('due_soon') due_soon?: boolean,
    @Query('overdue') overdue?: boolean,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    const options: GoalQueryOptions = {
      search,
      goal_type,
      status,
      priority,
      created_by,
      due_soon,
      overdue,
      page,
      limit,
    };
    return this.goalsService.findAll(householdId, options);
  }

  @Get('summary')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({
    summary: 'Get goals summary',
    description: 'Retrieve household goals summary with statistics and insights.',
  })
  @ApiOkResponse({
    description: 'Goals summary retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalGoals: { type: 'number' },
        activeGoals: { type: 'number' },
        completedGoals: { type: 'number' },
        totalTargetAmount: { type: 'number' },
        totalCurrentAmount: { type: 'number' },
        totalProgress: { type: 'number' },
        overdueGoals: { type: 'number' },
        goalsByType: { type: 'object' },
        goalsByPriority: { type: 'object' },
        upcomingDeadlines: { type: 'array', items: { type: 'object' } },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  getSummary(@CurrentHousehold() householdId: string) {
    return this.goalsService.getSummary(householdId);
  }

  @Get(':id')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({
    summary: 'Get goal details',
    description: 'Retrieve detailed information about a specific financial goal.',
  })
  @ApiParam({ name: 'id', description: 'Goal UUID' })
  @ApiOkResponse({
    description: 'Goal details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        description: { type: 'string' },
        goal_type: { type: 'string' },
        status: { type: 'string' },
        priority: { type: 'string' },
        target_amount: { type: 'number' },
        current_amount: { type: 'number' },
        target_date: { type: 'string', format: 'date-time' },
        completed_at: { type: 'string', format: 'date-time' },
        auto_contribute: { type: 'string' },
        auto_contribute_amount: { type: 'number' },
        next_contribution_date: { type: 'string', format: 'date-time' },
        progress_percentage: { type: 'number' },
        remaining_amount: { type: 'number' },
        days_remaining: { type: 'number' },
        required_monthly_contribution: { type: 'number' },
        creator: { type: 'object' },
        account: { type: 'object' },
        category: { type: 'object' },
        metadata: { type: 'object' },
        tags: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Goal not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentHousehold() householdId: string,
  ): Promise<Goal> {
    return this.goalsService.findOne(id, householdId);
  }

  @Patch(':id')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @ApiOperation({
    summary: 'Update goal',
    description: 'Update goal details such as target amount, date, or status.',
  })
  @ApiParam({ name: 'id', description: 'Goal UUID' })
  @ApiOkResponse({
    description: 'Goal updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        target_amount: { type: 'number' },
        current_amount: { type: 'number' },
        status: { type: 'string' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Goal not found' })
  @ApiBadRequestResponse({ description: 'Invalid update data' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateGoalDto: UpdateGoalDto,
    @CurrentHousehold() householdId: string,
    @CurrentUser() user: User,
  ): Promise<Goal> {
    return this.goalsService.update(id, updateGoalDto, householdId, user.id);
  }

  @Delete(':id')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete goal',
    description: 'Delete a financial goal. Only household administrators can delete goals.',
  })
  @ApiParam({ name: 'id', description: 'Goal UUID' })
  @ApiNoContentResponse({ description: 'Goal deleted successfully' })
  @ApiNotFoundResponse({ description: 'Goal not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentHousehold() householdId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.goalsService.remove(id, householdId, user.id);
  }

  @Post(':id/contribute')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @ApiOperation({
    summary: 'Make a contribution to goal',
    description: 'Add money to a financial goal to increase progress toward the target.',
  })
  @ApiParam({ name: 'id', description: 'Goal UUID' })
  @ApiOkResponse({
    description: 'Contribution added successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        current_amount: { type: 'number' },
        progress_percentage: { type: 'number' },
        remaining_amount: { type: 'number' },
        status: { type: 'string' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Goal not found' })
  @ApiBadRequestResponse({ description: 'Cannot contribute to inactive goal' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  contribute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() contributionDto: GoalContributionDto,
    @CurrentHousehold() householdId: string,
    @CurrentUser() user: User,
  ): Promise<Goal> {
    return this.goalsService.contribute(id, contributionDto, householdId, user.id);
  }

  @Post(':id/withdraw')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @ApiOperation({
    summary: 'Make a withdrawal from goal',
    description: 'Withdraw money from a financial goal (e.g., for emergency expenses).',
  })
  @ApiParam({ name: 'id', description: 'Goal UUID' })
  @ApiOkResponse({
    description: 'Withdrawal processed successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        current_amount: { type: 'number' },
        progress_percentage: { type: 'number' },
        remaining_amount: { type: 'number' },
        status: { type: 'string' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Goal not found' })
  @ApiBadRequestResponse({ description: 'Insufficient funds in goal for withdrawal' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() withdrawalDto: GoalWithdrawalDto,
    @CurrentHousehold() householdId: string,
    @CurrentUser() user: User,
  ): Promise<Goal> {
    return this.goalsService.withdraw(id, withdrawalDto, householdId, user.id);
  }

  @Get(':id/activities')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({
    summary: 'Get goal activities',
    description: 'Retrieve the activity history for a financial goal.',
  })
  @ApiParam({ name: 'id', description: 'Goal UUID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 50 })
  @ApiOkResponse({
    description: 'Goal activities retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        activities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              activity_type: { type: 'string' },
              amount: { type: 'number' },
              previous_value: { type: 'number' },
              new_value: { type: 'number' },
              description: { type: 'string' },
              performer: { type: 'object' },
              metadata: { type: 'object' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Goal not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  getActivities(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentHousehold() householdId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.goalsService.getActivities(id, householdId, page, limit);
  }
}
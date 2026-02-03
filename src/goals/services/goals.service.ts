import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { SelectQueryBuilder, Between, LessThan } from 'typeorm';
import { Goal, GoalType, GoalStatus, GoalPriority, RecurrenceType } from '../entities/goal.entity';
import { GoalActivity, GoalActivityType } from '../entities/goal-activity.entity';
import { CreateGoalDto, UpdateGoalDto, CreateGoalActivityDto, GoalContributionDto, GoalWithdrawalDto } from '../dto';
import { Account } from '../../accounts/entities/account.entity';
import { Category } from '../../expenses/entities/category.entity';
import { GoalRepository } from '../repositories/goal.repository';
import { GoalActivityRepository } from '../repositories/goal-activity.repository';
import { AccountsRepository } from '../../accounts/repositories/accounts.repository';
import { CategoryRepository } from '../../expenses/repositories/category.repository';

export interface GoalQueryOptions {
  search?: string;
  goal_type?: GoalType;
  status?: GoalStatus;
  priority?: GoalPriority;
  created_by?: string;
  due_soon?: boolean; // Goals due within 30 days
  overdue?: boolean;
  page?: number;
  limit?: number;
}

export interface GoalSummary {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  totalTargetAmount: number;
  totalCurrentAmount: number;
  totalProgress: number;
  overdueGoals: number;
  goalsByType: Record<GoalType, number>;
  goalsByPriority: Record<GoalPriority, number>;
  upcomingDeadlines: Goal[];
}

@Injectable()
export class GoalsService {
  constructor(
    private readonly goalRepository: GoalRepository,
    private readonly goalActivityRepository: GoalActivityRepository,
    private readonly accountRepository: AccountsRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async create(
    createGoalDto: CreateGoalDto,
    householdId: string,
    userId: string,
  ): Promise<Goal> {
    // Validate target date is in the future
    const targetDate = new Date(createGoalDto.target_date);
    if (targetDate <= new Date()) {
      throw new BadRequestException('Target date must be in the future');
    }

    // Validate account belongs to household if provided
    if (createGoalDto.account_id) {
      const account = await this.accountRepository.findOneWithHousehold(
        householdId,
        { where: { id: createGoalDto.account_id } },
      );
      if (!account) {
        throw new NotFoundException('Account not found or does not belong to household');
      }
    }

    // Validate category belongs to household if provided
    if (createGoalDto.category_id) {
      const category = await this.categoryRepository.findOneWithHousehold(
        householdId,
        { where: { id: createGoalDto.category_id } },
      );
      if (!category) {
        throw new NotFoundException('Category not found or does not belong to household');
      }
    }

    // Calculate next contribution date if auto-contribution is enabled
    let nextContributionDate: Date | undefined;
    if (createGoalDto.auto_contribute && createGoalDto.auto_contribute !== RecurrenceType.NONE) {
      if (!createGoalDto.auto_contribute_amount) {
        throw new BadRequestException('Auto contribution amount is required when auto contribution is enabled');
      }
      nextContributionDate = this.calculateNextContributionDate(createGoalDto.auto_contribute);
    }

    const goal = this.goalRepository.create({
      ...createGoalDto,
      household_id: householdId,
      created_by: userId,
      next_contribution_date: nextContributionDate,
    });

    const savedGoal = await this.goalRepository.saveWithHousehold(householdId, goal);

    // Create initial activity record
    await this.createActivity({
      goal_id: savedGoal.id,
      activity_type: GoalActivityType.GOAL_CREATED,
      description: `Goal "${goal.name}" created`,
      metadata: { 
        initial_target: goal.target_amount,
        initial_amount: goal.current_amount,
      },
    }, householdId, userId);

    return savedGoal;
  }

  async findAll(
    householdId: string,
    options: GoalQueryOptions = {},
  ): Promise<{ goals: Goal[]; meta: any }> {
    const {
      search,
      goal_type,
      status,
      priority,
      created_by,
      due_soon,
      overdue,
      page = 1,
      limit = 50,
    } = options;

    const queryBuilder = this.goalRepository
      .createQueryBuilderWithHousehold(householdId, 'goal')
      .leftJoinAndSelect('goal.creator', 'creator')
      .leftJoinAndSelect('goal.account', 'account')
      .leftJoinAndSelect('goal.category', 'category');

    if (search) {
      queryBuilder.andWhere(
        'LOWER(goal.name) LIKE LOWER(:search) OR LOWER(goal.description) LIKE LOWER(:search)',
        { search: `%${search}%` }
      );
    }

    if (goal_type) {
      queryBuilder.andWhere('goal.goal_type = :goal_type', { goal_type });
    }

    if (status) {
      queryBuilder.andWhere('goal.status = :status', { status });
    }

    if (priority) {
      queryBuilder.andWhere('goal.priority = :priority', { priority });
    }

    if (created_by) {
      queryBuilder.andWhere('goal.created_by = :created_by', { created_by });
    }

    if (due_soon) {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      queryBuilder.andWhere('goal.target_date <= :thirtyDaysFromNow AND goal.status = :activeStatus', {
        thirtyDaysFromNow,
        activeStatus: GoalStatus.ACTIVE,
      });
    }

    if (overdue) {
      queryBuilder.andWhere('goal.target_date < :now AND goal.status = :activeStatus', {
        now: new Date(),
        activeStatus: GoalStatus.ACTIVE,
      });
    }

    // Default ordering: priority desc, target date asc, created_at desc
    queryBuilder.orderBy('goal.priority', 'DESC')
                .addOrderBy('goal.target_date', 'ASC')
                .addOrderBy('goal.created_at', 'DESC');

    const [goals, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      goals,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, householdId: string): Promise<Goal> {
    const goal = await this.goalRepository.findOneWithHousehold(
      householdId,
      {
        where: { id },
        relations: ['creator', 'account', 'category'],
      },
    );

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    return goal;
  }

  async update(
    id: string,
    updateGoalDto: UpdateGoalDto,
    householdId: string,
    userId: string,
  ): Promise<Goal> {
    const goal = await this.findOne(id, householdId);

    // Validate target date if provided
    if (updateGoalDto.target_date) {
      const targetDate = new Date(updateGoalDto.target_date);
      if (targetDate <= new Date()) {
        throw new BadRequestException('Target date must be in the future');
      }
    }

    // Validate account if provided
    if (updateGoalDto.account_id) {
      const account = await this.accountRepository.findOneWithHousehold(
        householdId,
        { where: { id: updateGoalDto.account_id } },
      );
      if (!account) {
        throw new NotFoundException('Account not found or does not belong to household');
      }
    }

    // Validate category if provided
    if (updateGoalDto.category_id) {
      const category = await this.categoryRepository.findOneWithHousehold(
        householdId,
        { where: { id: updateGoalDto.category_id } },
      );
      if (!category) {
        throw new NotFoundException('Category not found or does not belong to household');
      }
    }

    // Handle auto contribution changes
    if (updateGoalDto.auto_contribute !== undefined) {
      if (updateGoalDto.auto_contribute !== RecurrenceType.NONE) {
        if (!updateGoalDto.auto_contribute_amount && !goal.auto_contribute_amount) {
          throw new BadRequestException('Auto contribution amount is required when auto contribution is enabled');
        }
        goal.next_contribution_date = this.calculateNextContributionDate(updateGoalDto.auto_contribute);
      } else {
        goal.next_contribution_date = undefined;
      }
    }

    const previousValues = {
      target_amount: goal.target_amount,
      status: goal.status,
    };

    Object.assign(goal, updateGoalDto);
    const updatedGoal = await this.goalRepository.saveWithHousehold(householdId, goal);

    // Create activity records for significant changes
    if (updateGoalDto.target_amount && previousValues.target_amount !== updateGoalDto.target_amount) {
      await this.createActivity({
        goal_id: id,
        activity_type: GoalActivityType.TARGET_UPDATED,
        previous_value: previousValues.target_amount,
        new_value: updateGoalDto.target_amount,
        description: `Target amount updated from $${previousValues.target_amount} to $${updateGoalDto.target_amount}`,
      }, householdId, userId);
    }

    if (updateGoalDto.status && previousValues.status !== updateGoalDto.status) {
      await this.createActivity({
        goal_id: id,
        activity_type: GoalActivityType.STATUS_CHANGED,
        description: `Status changed from ${previousValues.status} to ${updateGoalDto.status}`,
        metadata: { previous_status: previousValues.status, new_status: updateGoalDto.status },
      }, householdId, userId);

      // Handle goal completion
      if (updateGoalDto.status === GoalStatus.COMPLETED) {
        goal.completed_at = new Date();
        await this.goalRepository.saveWithHousehold(householdId, goal);
        
        await this.createActivity({
          goal_id: id,
          activity_type: GoalActivityType.GOAL_COMPLETED,
          description: `Goal "${goal.name}" completed!`,
          metadata: { 
            completion_date: goal.completed_at,
            final_amount: goal.current_amount,
            target_amount: goal.target_amount,
          },
        }, householdId, userId);
      }
    }

    return updatedGoal;
  }

  async remove(id: string, householdId: string, userId: string): Promise<void> {
    const goal = await this.findOne(id, householdId);

    await this.createActivity({
      goal_id: id,
      activity_type: GoalActivityType.GOAL_CANCELLED,
      description: `Goal "${goal.name}" cancelled and deleted`,
      metadata: { 
        cancellation_date: new Date(),
        final_amount: goal.current_amount,
        target_amount: goal.target_amount,
      },
    }, householdId, userId);

    await this.goalRepository.softDelete(id);
  }

  async contribute(
    id: string,
    contributionDto: GoalContributionDto,
    householdId: string,
    userId: string,
  ): Promise<Goal> {
    const goal = await this.findOne(id, householdId);

    if (goal.status !== GoalStatus.ACTIVE) {
      throw new BadRequestException('Cannot contribute to inactive goal');
    }

    const previousAmount = goal.current_amount;
    goal.current_amount += contributionDto.amount;

    // Check if goal is now completed
    if (goal.current_amount >= goal.target_amount) {
      goal.status = GoalStatus.COMPLETED;
      goal.completed_at = new Date();
    }

    const updatedGoal = await this.goalRepository.saveWithHousehold(householdId, goal);

    // Create contribution activity
    await this.createActivity({
      goal_id: id,
      activity_type: GoalActivityType.MANUAL_CONTRIBUTION,
      amount: contributionDto.amount,
      previous_value: previousAmount,
      new_value: goal.current_amount,
      description: contributionDto.description || `Manual contribution of $${contributionDto.amount}`,
      transaction_id: contributionDto.transaction_id,
    }, householdId, userId);

    // Check for milestones (25%, 50%, 75%, 100%)
    const progressPercentage = (goal.current_amount / goal.target_amount) * 100;
    const previousProgressPercentage = (previousAmount / goal.target_amount) * 100;
    
    const milestones = [25, 50, 75, 100];
    for (const milestone of milestones) {
      if (previousProgressPercentage < milestone && progressPercentage >= milestone) {
        await this.createActivity({
          goal_id: id,
          activity_type: GoalActivityType.MILESTONE_REACHED,
          description: `${milestone}% milestone reached!`,
          metadata: { milestone, percentage: progressPercentage },
        }, householdId, userId);
        break; // Only record one milestone per contribution
      }
    }

    return updatedGoal;
  }

  async withdraw(
    id: string,
    withdrawalDto: GoalWithdrawalDto,
    householdId: string,
    userId: string,
  ): Promise<Goal> {
    const goal = await this.findOne(id, householdId);

    if (goal.current_amount < withdrawalDto.amount) {
      throw new BadRequestException('Insufficient funds in goal for withdrawal');
    }

    const previousAmount = goal.current_amount;
    goal.current_amount -= withdrawalDto.amount;

    // If goal was completed but now falls below target, mark as active
    if (goal.status === GoalStatus.COMPLETED && goal.current_amount < goal.target_amount) {
      goal.status = GoalStatus.ACTIVE;
      goal.completed_at = undefined;
    }

    const updatedGoal = await this.goalRepository.saveWithHousehold(householdId, goal);

    // Create withdrawal activity
    await this.createActivity({
      goal_id: id,
      activity_type: GoalActivityType.WITHDRAWAL,
      amount: withdrawalDto.amount,
      previous_value: previousAmount,
      new_value: goal.current_amount,
      description: `Withdrawal: ${withdrawalDto.reason}`,
      transaction_id: withdrawalDto.transaction_id,
    }, householdId, userId);

    return updatedGoal;
  }

  async getActivities(
    id: string,
    householdId: string,
    page = 1,
    limit = 50,
  ): Promise<{ activities: GoalActivity[]; meta: any }> {
    await this.findOne(id, householdId); // Verify goal exists and user has access

    const skip = (page - 1) * limit;
    const queryBuilder = this.goalActivityRepository
      .createQueryBuilderWithHousehold(householdId, 'activity')
      .leftJoinAndSelect('activity.performer', 'performer')
      .where('activity.goal_id = :goalId', { goalId: id })
      .orderBy('activity.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    const [activities, total] = await queryBuilder.getManyAndCount();

    return {
      activities,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSummary(householdId: string): Promise<GoalSummary> {
    const goals = await this.goalRepository.findWithHousehold(householdId, {});

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const summary: GoalSummary = {
      totalGoals: goals.length,
      activeGoals: goals.filter(g => g.status === GoalStatus.ACTIVE).length,
      completedGoals: goals.filter(g => g.status === GoalStatus.COMPLETED).length,
      totalTargetAmount: goals.reduce((sum, g) => sum + Number(g.target_amount), 0),
      totalCurrentAmount: goals.reduce((sum, g) => sum + Number(g.current_amount), 0),
      totalProgress: 0,
      overdueGoals: goals.filter(g => 
        g.status === GoalStatus.ACTIVE && new Date(g.target_date) < now
      ).length,
      goalsByType: {} as Record<GoalType, number>,
      goalsByPriority: {} as Record<GoalPriority, number>,
      upcomingDeadlines: goals.filter(g => 
        g.status === GoalStatus.ACTIVE && 
        new Date(g.target_date) <= thirtyDaysFromNow && 
        new Date(g.target_date) >= now
      ).sort((a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime()).slice(0, 5),
    };

    summary.totalProgress = summary.totalTargetAmount > 0 
      ? (summary.totalCurrentAmount / summary.totalTargetAmount) * 100 
      : 0;

    // Initialize counts
    Object.values(GoalType).forEach(type => summary.goalsByType[type] = 0);
    Object.values(GoalPriority).forEach(priority => summary.goalsByPriority[priority] = 0);

    // Count goals by type and priority
    goals.forEach(goal => {
      summary.goalsByType[goal.goal_type]++;
      summary.goalsByPriority[goal.priority]++;
    });

    return summary;
  }

  private async createActivity(
    activityDto: CreateGoalActivityDto,
    householdId: string,
    userId: string,
  ): Promise<GoalActivity> {
    const activity = this.goalActivityRepository.create({
      ...activityDto,
      household_id: householdId,
      performed_by: userId,
    });

    return this.goalActivityRepository.saveWithHousehold(householdId, activity);
  }

  private calculateNextContributionDate(recurrenceType: RecurrenceType): Date {
    const now = new Date();
    const nextDate = new Date(now);

    switch (recurrenceType) {
      case RecurrenceType.DAILY:
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case RecurrenceType.WEEKLY:
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case RecurrenceType.MONTHLY:
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case RecurrenceType.QUARTERLY:
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case RecurrenceType.YEARLY:
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      default:
        return now;
    }

    return nextDate;
  }
}
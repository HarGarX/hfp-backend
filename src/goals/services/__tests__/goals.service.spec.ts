import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { GoalsService } from '../goals.service';
import { Goal, GoalType, GoalStatus, GoalPriority, RecurrenceType } from '../../entities/goal.entity';
import { GoalActivity, GoalActivityType } from '../../entities/goal-activity.entity';
import { Account } from '../../../accounts/entities/account.entity';
import { Category } from '../../../expenses/entities/category.entity';
import { CreateGoalDto, GoalContributionDto, GoalWithdrawalDto } from '../../dto';

// Mock data
const mockHouseholdId = 'household-123';
const mockUserId = 'user-456';
const mockAccountId = 'account-789';
const mockCategoryId = 'category-101';

const mockGoal: Partial<Goal> = {
  id: 'goal-123',
  household_id: mockHouseholdId,
  name: 'Emergency Fund',
  description: 'Build emergency fund for 6 months of expenses',
  goal_type: GoalType.EMERGENCY_FUND,
  status: GoalStatus.ACTIVE,
  priority: GoalPriority.HIGH,
  target_amount: 25000,
  current_amount: 5000,
  target_date: new Date('2025-12-31'),
  created_by: mockUserId,
  auto_contribute: RecurrenceType.MONTHLY,
  auto_contribute_amount: 1000,
  next_contribution_date: new Date('2025-12-01'),
  tags: ['emergency', 'savings'],
  notes: 'Priority goal for financial security',
  get progress_percentage() { return (this.current_amount / this.target_amount) * 100; },
  get remaining_amount() { return this.target_amount - this.current_amount; },
  get days_remaining() { 
    const now = new Date();
    const target = new Date(this.target_date);
    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  },
  get required_monthly_contribution() {
    const monthsRemaining = this.days_remaining / 30;
    return monthsRemaining > 0 ? this.remaining_amount / monthsRemaining : 0;
  },
  created_at: new Date(),
  updated_at: new Date(),
};

const mockGoalActivity: Partial<GoalActivity> = {
  id: 'activity-123',
  goal_id: 'goal-123',
  household_id: mockHouseholdId,
  activity_type: GoalActivityType.MANUAL_CONTRIBUTION,
  amount: 500,
  previous_value: 5000,
  new_value: 5500,
  description: 'Manual contribution',
  performed_by: mockUserId,
  created_at: new Date(),
};

const mockAccount: Partial<Account> = {
  id: mockAccountId,
  household_id: mockHouseholdId,
  name: 'Savings Account',
  account_type: 'savings' as any,
};

const mockCategory: Partial<Category> = {
  id: mockCategoryId,
  household_id: mockHouseholdId,
  name: 'Emergency Fund',
  category_type: 'expense' as any,
};

describe('GoalsService', () => {
  let service: GoalsService;
  let goalRepository: jest.Mocked<Repository<Goal>>;
  let goalActivityRepository: jest.Mocked<Repository<GoalActivity>>;
  let accountRepository: jest.Mocked<Repository<Account>>;
  let categoryRepository: jest.Mocked<Repository<Category>>;

  beforeEach(async () => {
    const mockGoalRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      softDelete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockGoalActivityRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn(),
    };

    const mockAccountRepository = {
      findOne: jest.fn(),
    };

    const mockCategoryRepository = {
      findOne: jest.fn(),
    };

    const mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };

    mockGoalRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        {
          provide: getRepositoryToken(Goal),
          useValue: mockGoalRepository,
        },
        {
          provide: getRepositoryToken(GoalActivity),
          useValue: mockGoalActivityRepository,
        },
        {
          provide: getRepositoryToken(Account),
          useValue: mockAccountRepository,
        },
        {
          provide: getRepositoryToken(Category),
          useValue: mockCategoryRepository,
        },
      ],
    }).compile();

    service = module.get<GoalsService>(GoalsService);
    goalRepository = module.get(getRepositoryToken(Goal));
    goalActivityRepository = module.get(getRepositoryToken(GoalActivity));
    accountRepository = module.get(getRepositoryToken(Account));
    categoryRepository = module.get(getRepositoryToken(Category));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createGoalDto: CreateGoalDto = {
      name: 'Emergency Fund',
      description: 'Build emergency fund for 6 months of expenses',
      goal_type: GoalType.EMERGENCY_FUND,
      priority: GoalPriority.HIGH,
      target_amount: 25000,
      current_amount: 0,
      target_date: '2025-12-31T23:59:59.000Z',
      auto_contribute: RecurrenceType.MONTHLY,
      auto_contribute_amount: 1000,
      account_id: mockAccountId,
      category_id: mockCategoryId,
      tags: ['emergency', 'savings'],
      notes: 'Priority goal',
    };

    beforeEach(() => {
      accountRepository.findOne.mockResolvedValue(mockAccount as Account);
      categoryRepository.findOne.mockResolvedValue(mockCategory as Category);
      goalRepository.create.mockReturnValue(mockGoal as Goal);
      goalRepository.save.mockResolvedValue(mockGoal as Goal);
      goalActivityRepository.create.mockReturnValue(mockGoalActivity as GoalActivity);
      goalActivityRepository.save.mockResolvedValue(mockGoalActivity as GoalActivity);
    });

    it('should create a goal successfully', async () => {
      const result = await service.create(createGoalDto, mockHouseholdId, mockUserId);

      expect(goalRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createGoalDto,
          household_id: mockHouseholdId,
          created_by: mockUserId,
          next_contribution_date: expect.any(Date),
        })
      );
      expect(goalRepository.save).toHaveBeenCalled();
      expect(goalActivityRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          activity_type: GoalActivityType.GOAL_CREATED,
        })
      );
      expect(result).toEqual(mockGoal);
    });

    it('should throw BadRequestException if target date is in the past', async () => {
      const pastDateDto = { ...createGoalDto, target_date: '2020-01-01T00:00:00.000Z' };

      await expect(service.create(pastDateDto, mockHouseholdId, mockUserId))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if account does not belong to household', async () => {
      accountRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createGoalDto, mockHouseholdId, mockUserId))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if category does not belong to household', async () => {
      categoryRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createGoalDto, mockHouseholdId, mockUserId))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if auto contribution is enabled without amount', async () => {
      const invalidDto = { 
        ...createGoalDto, 
        auto_contribute: RecurrenceType.MONTHLY,
        auto_contribute_amount: undefined 
      };

      await expect(service.create(invalidDto, mockHouseholdId, mockUserId))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockGoal], 1]),
      };
      
      goalRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
    });

    it('should return paginated goals', async () => {
      const result = await service.findAll(mockHouseholdId, { page: 1, limit: 10 });

      expect(result.goals).toEqual([mockGoal]);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it('should apply search filters', async () => {
      await service.findAll(mockHouseholdId, { search: 'emergency' });

      const queryBuilder = goalRepository.createQueryBuilder();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'LOWER(goal.name) LIKE LOWER(:search) OR LOWER(goal.description) LIKE LOWER(:search)',
        { search: '%emergency%' }
      );
    });

    it('should filter by goal type', async () => {
      await service.findAll(mockHouseholdId, { goal_type: GoalType.EMERGENCY_FUND });

      const queryBuilder = goalRepository.createQueryBuilder();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'goal.goal_type = :goal_type',
        { goal_type: GoalType.EMERGENCY_FUND }
      );
    });

    it('should filter by status', async () => {
      await service.findAll(mockHouseholdId, { status: GoalStatus.ACTIVE });

      const queryBuilder = goalRepository.createQueryBuilder();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'goal.status = :status',
        { status: GoalStatus.ACTIVE }
      );
    });
  });

  describe('findOne', () => {
    it('should return a goal by id', async () => {
      goalRepository.findOne.mockResolvedValue(mockGoal as Goal);

      const result = await service.findOne('goal-123', mockHouseholdId);

      expect(goalRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'goal-123', household_id: mockHouseholdId },
        relations: ['creator', 'account', 'category'],
      });
      expect(result).toEqual(mockGoal);
    });

    it('should throw NotFoundException if goal not found', async () => {
      goalRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', mockHouseholdId))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('contribute', () => {
    const contributionDto: GoalContributionDto = {
      amount: 500,
      description: 'Monthly savings',
    };

    beforeEach(() => {
      goalRepository.findOne.mockResolvedValue(mockGoal as Goal);
      goalRepository.save.mockResolvedValue({
        ...mockGoal,
        current_amount: 5500,
      } as Goal);
      goalActivityRepository.create.mockReturnValue(mockGoalActivity as GoalActivity);
      goalActivityRepository.save.mockResolvedValue(mockGoalActivity as GoalActivity);
    });

    it('should add contribution to goal', async () => {
      const result = await service.contribute('goal-123', contributionDto, mockHouseholdId, mockUserId);

      expect(goalRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          current_amount: 5500,
        })
      );
      expect(goalActivityRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          activity_type: GoalActivityType.MANUAL_CONTRIBUTION,
          amount: 500,
        })
      );
      expect(result.current_amount).toBe(5500);
    });

    it('should mark goal as completed when target is reached', async () => {
      const completingContribution: GoalContributionDto = {
        amount: 20000,
        description: 'Final contribution',
      };

      const result = await service.contribute('goal-123', completingContribution, mockHouseholdId, mockUserId);

      expect(goalRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: GoalStatus.COMPLETED,
          completed_at: expect.any(Date),
        })
      );
    });

    it('should throw BadRequestException if goal is not active', async () => {
      goalRepository.findOne.mockResolvedValue({
        ...mockGoal,
        status: GoalStatus.COMPLETED,
      } as Goal);

      await expect(service.contribute('goal-123', contributionDto, mockHouseholdId, mockUserId))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('withdraw', () => {
    const withdrawalDto: GoalWithdrawalDto = {
      amount: 1000,
      reason: 'Emergency car repair',
    };

    beforeEach(() => {
      // Reset all mocks before each test
      jest.clearAllMocks();
      goalActivityRepository.create.mockReturnValue(mockGoalActivity as GoalActivity);
      goalActivityRepository.save.mockResolvedValue(mockGoalActivity as GoalActivity);
    });

    it('should withdraw from goal successfully', async () => {
      // Create a fresh goal object for this test to avoid mutation issues
      const testGoal = {
        ...mockGoal,
        current_amount: 5000,
      } as Goal;
      
      goalRepository.findOne.mockResolvedValue(testGoal);
      
      // Mock save to return the goal with updated amount
      goalRepository.save.mockImplementation((goal) => {
        return Promise.resolve({
          ...goal,
          current_amount: 4000, // The expected result after withdrawal
        } as Goal);
      });

      const result = await service.withdraw('goal-123', withdrawalDto, mockHouseholdId, mockUserId);

      expect(goalRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          current_amount: 4000,
        })
      );
      expect(goalActivityRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          activity_type: GoalActivityType.WITHDRAWAL,
          amount: 1000,
        })
      );
      expect(result.current_amount).toBe(4000);
    });

    it('should throw BadRequestException if insufficient funds', async () => {
      // Create a goal with not enough funds
      const testGoal = {
        ...mockGoal,
        current_amount: 5000,
      } as Goal;
      
      goalRepository.findOne.mockResolvedValue(testGoal);

      const largeWithdrawal: GoalWithdrawalDto = {
        amount: 10000, // More than the 5000 current amount
        reason: 'Too much',
      };

      await expect(service.withdraw('goal-123', largeWithdrawal, mockHouseholdId, mockUserId))
        .rejects.toThrow(BadRequestException);
        
      // Ensure save was never called due to insufficient funds
      expect(goalRepository.save).not.toHaveBeenCalled();
    });

    it('should reactivate completed goal if withdrawal brings it below target', async () => {
      const completedGoal = {
        ...mockGoal,
        status: GoalStatus.COMPLETED,
        current_amount: 25000,
        completed_at: new Date(),
      };
      
      goalRepository.findOne.mockResolvedValue(completedGoal as Goal);
      goalRepository.save.mockResolvedValue({
        ...completedGoal,
        current_amount: 24000,
        status: GoalStatus.ACTIVE,
        completed_at: undefined,
      } as Goal);

      const result = await service.withdraw('goal-123', withdrawalDto, mockHouseholdId, mockUserId);

      expect(goalRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: GoalStatus.ACTIVE,
          completed_at: undefined,
        })
      );
    });
  });

  describe('getSummary', () => {
    beforeEach(() => {
      goalRepository.find.mockResolvedValue([
        {
          ...mockGoal,
          status: GoalStatus.ACTIVE,
          goal_type: GoalType.EMERGENCY_FUND,
          priority: GoalPriority.HIGH,
          current_amount: 5000,
          target_amount: 25000,
        },
        {
          ...mockGoal,
          id: 'goal-456',
          status: GoalStatus.COMPLETED,
          goal_type: GoalType.SAVINGS,
          priority: GoalPriority.MEDIUM,
          current_amount: 5000,
          target_amount: 25000,
        }
      ] as Goal[]);
    });

    it('should return comprehensive summary', async () => {
      const summary = await service.getSummary(mockHouseholdId);

      expect(summary.totalGoals).toBe(2);
      expect(summary.activeGoals).toBe(1);
      expect(summary.completedGoals).toBe(1);
      expect(summary.totalTargetAmount).toBe(50000);
      expect(summary.totalCurrentAmount).toBe(10000);
      expect(summary.totalProgress).toBe(20);
      expect(summary.goalsByType).toHaveProperty(GoalType.EMERGENCY_FUND, 1);
      expect(summary.goalsByType).toHaveProperty(GoalType.SAVINGS, 1);
      expect(summary.goalsByPriority).toHaveProperty(GoalPriority.HIGH, 1);
      expect(summary.goalsByPriority).toHaveProperty(GoalPriority.MEDIUM, 1);
    });
  });
});
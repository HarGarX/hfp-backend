import { Test, TestingModule } from '@nestjs/testing';
import { GoalsController } from './goals.controller';
import { GoalsService } from '../services/goals.service';
import { CreateGoalDto, UpdateGoalDto, GoalContributionDto, GoalWithdrawalDto } from '../dto';
import { Goal, GoalType, GoalStatus, GoalPriority, RecurrenceType } from '../entities/goal.entity';
import { User, UserRole } from '../../users/entities/user.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('GoalsController', () => {
  let controller: GoalsController;
  let service: jest.Mocked<GoalsService>;

  const mockHouseholdId = 'household-123';
  const mockUserId = 'user-123';

  const mockGoal: Partial<Goal> = {
    id: 'goal-123',
    name: 'Emergency Fund',
    description: 'Build an emergency fund for unexpected expenses',
    goal_type: GoalType.EMERGENCY_FUND,
    status: GoalStatus.ACTIVE,
    priority: GoalPriority.HIGH,
    target_amount: 10000,
    current_amount: 2500,
    target_date: new Date('2024-12-31'),
    auto_contribute: RecurrenceType.MONTHLY,
    auto_contribute_amount: 500,
    progress_percentage: 25,
    remaining_amount: 7500,
    days_remaining: 365,
    required_monthly_contribution: 625,
    household_id: mockHouseholdId,
    created_by: mockUserId,
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
      getSummary: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      contribute: jest.fn(),
      withdraw: jest.fn(),
      getActivities: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoalsController],
      providers: [
        {
          provide: GoalsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<GoalsController>(GoalsController);
    service = module.get(GoalsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateGoalDto = {
      name: 'Vacation Fund',
      description: 'Save for summer vacation',
      goal_type: GoalType.VACATION,
      target_amount: 5000,
      target_date: '2024-06-01',
      priority: GoalPriority.MEDIUM,
      auto_contribute: RecurrenceType.MONTHLY,
      auto_contribute_amount: 200,
    };

    it('should create a goal successfully', async () => {
      service.create.mockResolvedValue(mockGoal as Goal);

      const result = await controller.create(createDto, mockHouseholdId, mockUser as User);

      expect(service.create).toHaveBeenCalledWith(createDto, mockHouseholdId, mockUserId);
      expect(result).toEqual(mockGoal);
    });

    it('should handle BadRequestException for target date in the past', async () => {
      service.create.mockRejectedValue(new BadRequestException('Target date cannot be in the past'));

      await expect(controller.create(createDto, mockHouseholdId, mockUser as User)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    const mockGoalsResponse = {
      goals: [mockGoal],
      meta: {
        page: 1,
        limit: 50,
        total: 1,
        totalPages: 1,
      },
    };

    it('should return paginated goals with default parameters', async () => {
      service.findAll.mockResolvedValue(mockGoalsResponse as any);

      const result = await controller.findAll(mockHouseholdId);

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, {
        search: undefined,
        goal_type: undefined,
        status: undefined,
        priority: undefined,
        created_by: undefined,
        due_soon: undefined,
        overdue: undefined,
        page: undefined,
        limit: undefined,
      });
      expect(result).toEqual(mockGoalsResponse);
    });

    it('should return paginated goals with all filters', async () => {
      service.findAll.mockResolvedValue(mockGoalsResponse as any);

      const result = await controller.findAll(
        mockHouseholdId,
        'emergency',
        GoalType.EMERGENCY_FUND,
        GoalStatus.ACTIVE,
        GoalPriority.HIGH,
        'user-123',
        true,
        false,
        2,
        10
      );

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, {
        search: 'emergency',
        goal_type: GoalType.EMERGENCY_FUND,
        status: GoalStatus.ACTIVE,
        priority: GoalPriority.HIGH,
        created_by: 'user-123',
        due_soon: true,
        overdue: false,
        page: 2,
        limit: 10,
      });
      expect(result).toEqual(mockGoalsResponse);
    });
  });

  describe('getSummary', () => {
    const mockSummary = {
      totalGoals: 5,
      activeGoals: 3,
      completedGoals: 2,
      totalTargetAmount: 50000,
      totalCurrentAmount: 15000,
      totalProgress: 30,
      overdueGoals: 1,
      goalsByType: {
        [GoalType.EMERGENCY_FUND]: 1,
        [GoalType.VACATION]: 2,
        [GoalType.PURCHASE]: 1,
        [GoalType.SAVINGS]: 1,
        [GoalType.DEBT_PAYOFF]: 0,
        [GoalType.INVESTMENT]: 0,
        [GoalType.CUSTOM]: 0,
      },
      goalsByPriority: {
        [GoalPriority.HIGH]: 2,
        [GoalPriority.MEDIUM]: 2,
        [GoalPriority.LOW]: 1,
        [GoalPriority.CRITICAL]: 0,
      },
      upcomingDeadlines: [
        { ...mockGoal, name: 'Emergency Fund', target_date: new Date('2024-12-31') } as Goal,
      ],
    };

    it('should return goals summary', async () => {
      service.getSummary.mockResolvedValue(mockSummary);

      const result = await controller.getSummary(mockHouseholdId);

      expect(service.getSummary).toHaveBeenCalledWith(mockHouseholdId);
      expect(result).toEqual(mockSummary);
    });
  });

  describe('findOne', () => {
    it('should return a goal by id', async () => {
      service.findOne.mockResolvedValue(mockGoal as Goal);

      const result = await controller.findOne('goal-123', mockHouseholdId);

      expect(service.findOne).toHaveBeenCalledWith('goal-123', mockHouseholdId);
      expect(result).toEqual(mockGoal);
    });

    it('should handle NotFoundException', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Goal not found'));

      await expect(controller.findOne('nonexistent-id', mockHouseholdId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateGoalDto = {
      name: 'Updated Emergency Fund',
      target_amount: 12000,
      priority: GoalPriority.CRITICAL,
    };

    it('should update a goal successfully', async () => {
      const updatedGoal = { ...mockGoal, ...updateDto };
      service.update.mockResolvedValue(updatedGoal as Goal);

      const result = await controller.update('goal-123', updateDto, mockHouseholdId, mockUser as User);

      expect(service.update).toHaveBeenCalledWith('goal-123', updateDto, mockHouseholdId, mockUserId);
      expect(result).toEqual(updatedGoal);
    });

    it('should handle NotFoundException', async () => {
      service.update.mockRejectedValue(new NotFoundException('Goal not found'));

      await expect(controller.update('nonexistent-id', updateDto, mockHouseholdId, mockUser as User)).rejects.toThrow(NotFoundException);
    });

    it('should handle BadRequestException for invalid data', async () => {
      service.update.mockRejectedValue(new BadRequestException('Invalid target amount'));

      await expect(controller.update('goal-123', updateDto, mockHouseholdId, mockUser as User)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove a goal successfully', async () => {
      service.remove.mockResolvedValue();

      await controller.remove('goal-123', mockHouseholdId, mockUser as User);

      expect(service.remove).toHaveBeenCalledWith('goal-123', mockHouseholdId, mockUserId);
    });

    it('should handle NotFoundException', async () => {
      service.remove.mockRejectedValue(new NotFoundException('Goal not found'));

      await expect(controller.remove('nonexistent-id', mockHouseholdId, mockUser as User)).rejects.toThrow(NotFoundException);
    });
  });

  describe('contribute', () => {
    const contributionDto: GoalContributionDto = {
      amount: 1000,
      description: 'Monthly contribution',
      transaction_id: 'transaction-123',
    };

    it('should make a contribution successfully', async () => {
      const updatedGoal = { 
        ...mockGoal, 
        current_amount: 3500, 
        progress_percentage: 35,
        remaining_amount: 6500 
      };
      service.contribute.mockResolvedValue(updatedGoal as Goal);

      const result = await controller.contribute('goal-123', contributionDto, mockHouseholdId, mockUser as User);

      expect(service.contribute).toHaveBeenCalledWith('goal-123', contributionDto, mockHouseholdId, mockUserId);
      expect(result).toEqual(updatedGoal);
    });

    it('should handle NotFoundException for goal', async () => {
      service.contribute.mockRejectedValue(new NotFoundException('Goal not found'));

      await expect(controller.contribute('nonexistent-id', contributionDto, mockHouseholdId, mockUser as User)).rejects.toThrow(NotFoundException);
    });

    it('should handle BadRequestException for inactive goal', async () => {
      service.contribute.mockRejectedValue(new BadRequestException('Cannot contribute to inactive goal'));

      await expect(controller.contribute('goal-123', contributionDto, mockHouseholdId, mockUser as User)).rejects.toThrow(BadRequestException);
    });
  });

  describe('withdraw', () => {
    const withdrawalDto: GoalWithdrawalDto = {
      amount: 500,
      reason: 'Unexpected medical expense',
    };

    it('should make a withdrawal successfully', async () => {
      const updatedGoal = { 
        ...mockGoal, 
        current_amount: 2000, 
        progress_percentage: 20,
        remaining_amount: 8000 
      };
      service.withdraw.mockResolvedValue(updatedGoal as Goal);

      const result = await controller.withdraw('goal-123', withdrawalDto, mockHouseholdId, mockUser as User);

      expect(service.withdraw).toHaveBeenCalledWith('goal-123', withdrawalDto, mockHouseholdId, mockUserId);
      expect(result).toEqual(updatedGoal);
    });

    it('should handle NotFoundException for goal', async () => {
      service.withdraw.mockRejectedValue(new NotFoundException('Goal not found'));

      await expect(controller.withdraw('nonexistent-id', withdrawalDto, mockHouseholdId, mockUser as User)).rejects.toThrow(NotFoundException);
    });

    it('should handle BadRequestException for insufficient funds', async () => {
      service.withdraw.mockRejectedValue(new BadRequestException('Insufficient funds in goal for withdrawal'));

      await expect(controller.withdraw('goal-123', withdrawalDto, mockHouseholdId, mockUser as User)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getActivities', () => {
    const mockActivitiesResponse = {
      activities: [
        {
          id: 'activity-123',
          activity_type: 'contribution',
          amount: 1000,
          previous_value: 2500,
          new_value: 3500,
          description: 'Monthly contribution',
          performer: { id: mockUserId, name: 'Test User' },
          metadata: { transaction_id: 'transaction-123' },
          created_at: new Date(),
        },
      ],
      meta: {
        page: 1,
        limit: 50,
        total: 1,
        totalPages: 1,
      },
    };

    it('should return goal activities with default pagination', async () => {
      service.getActivities.mockResolvedValue(mockActivitiesResponse as any);

      const result = await controller.getActivities('goal-123', mockHouseholdId);

      expect(service.getActivities).toHaveBeenCalledWith('goal-123', mockHouseholdId, undefined, undefined);
      expect(result).toEqual(mockActivitiesResponse);
    });

    it('should return goal activities with custom pagination', async () => {
      service.getActivities.mockResolvedValue(mockActivitiesResponse as any);

      const result = await controller.getActivities('goal-123', mockHouseholdId, 2, 10);

      expect(service.getActivities).toHaveBeenCalledWith('goal-123', mockHouseholdId, 2, 10);
      expect(result).toEqual(mockActivitiesResponse);
    });

    it('should handle NotFoundException for goal', async () => {
      service.getActivities.mockRejectedValue(new NotFoundException('Goal not found'));

      await expect(controller.getActivities('nonexistent-id', mockHouseholdId)).rejects.toThrow(NotFoundException);
    });
  });
});
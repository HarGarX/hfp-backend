import { Test, TestingModule } from '@nestjs/testing';
import { HealthScoreController } from './health-score.controller';
import { FinancialHealthScoreService } from '../services/financial-health-score.service';
import {
  GenerateHealthScoreDto,
  HealthScoreDto,
  HealthScoreHistoryDto,
} from '../dto';
import { HealthScoreCategory } from '../entities/financial-health-score.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('HealthScoreController', () => {
  let controller: HealthScoreController;
  let service: jest.Mocked<FinancialHealthScoreService>;

  const mockHouseholdId = 'household-123';
  const mockUserId = 'user-123';
  const mockOtherUserId = 'user-456';

  const mockRequest = {
    user: {
      userId: mockUserId,
      householdId: mockHouseholdId,
    },
  };

  const mockHealthScore: HealthScoreDto = {
    overall_score: 75,
    score_grade: 'Good',
    improvement_trend: 'improving',
    top_strength: HealthScoreCategory.SAVINGS,
    biggest_opportunity: HealthScoreCategory.DEBT_MANAGEMENT,
    category_scores: {
      [HealthScoreCategory.BUDGETING]: {
        score: 80,
        weight: 0.15,
        trends: {
          previous_score: 75,
          change_percentage: 6.67,
          trend_direction: 'up',
        },
        recommendations: ['Review monthly budget allocations'],
      },
      [HealthScoreCategory.SAVINGS]: {
        score: 90,
        weight: 0.20,
        trends: {
          previous_score: 85,
          change_percentage: 5.88,
          trend_direction: 'up',
        },
      },
      [HealthScoreCategory.DEBT_MANAGEMENT]: {
        score: 60,
        weight: 0.20,
        trends: {
          trend_direction: 'down',
        },
        recommendations: ['Focus on high-interest debt first'],
      },
      [HealthScoreCategory.GOAL_PROGRESS]: {
        score: 75,
        weight: 0.15,
        trends: {
          trend_direction: 'stable',
        },
      },
      [HealthScoreCategory.CASH_FLOW]: {
        score: 70,
        weight: 0.15,
        trends: {
          trend_direction: 'stable',
        },
      },
      [HealthScoreCategory.EMERGENCY_FUND]: {
        score: 65,
        weight: 0.10,
        trends: {
          trend_direction: 'up',
        },
        recommendations: ['Build emergency fund to 6 months'],
      },
      [HealthScoreCategory.CREDIT_UTILIZATION]: {
        score: 85,
        weight: 0.05,
        trends: {
          trend_direction: 'stable',
        },
      },
      [HealthScoreCategory.INVESTMENT_DIVERSITY]: {
        score: 50,
        weight: 0.05,
        trends: {
          trend_direction: 'stable',
        },
        recommendations: ['Consider diversifying investments'],
      },
    },
    metrics: {
      income_stability: 85,
      expense_ratio: 70,
      savings_rate: 20,
      debt_to_income_ratio: 35,
      credit_utilization: 25,
      on_time_payments: 100,
      active_goals_count: 3,
      goal_completion_rate: 75,
      emergency_fund_months: 4,
      cash_flow_volatility: 15,
      recurring_income_percentage: 90,
      budget_adherence: 80,
      transaction_categorization_accuracy: 95,
      financial_app_engagement: 85,
    },
    benchmarks: {
      peer_group: {
        age_range: '25-35',
        income_range: '$50k-$75k',
        household_size: 2,
      },
      percentile_ranking: 75,
      top_improvement_areas: ['Debt Management', 'Emergency Fund'],
      strengths: ['Savings Rate', 'Payment History'],
    },
    calculated_at: new Date().toISOString(),
    next_calculation_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const mockHealthScoreHistory: HealthScoreHistoryDto = {
    history: [
      {
        date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        overall_score: 70,
        score_grade: 'Good',
        trend: 'stable',
      },
      {
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        overall_score: 72,
        score_grade: 'Good',
        trend: 'improving',
      },
      {
        date: new Date().toISOString(),
        overall_score: 75,
        score_grade: 'Good',
        trend: 'improving',
      },
    ],
    category_trends: {
      [HealthScoreCategory.BUDGETING]: [
        { date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), score: 75 },
        { date: new Date().toISOString(), score: 80 },
      ],
      [HealthScoreCategory.SAVINGS]: [
        { date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), score: 85 },
        { date: new Date().toISOString(), score: 90 },
      ],
      [HealthScoreCategory.DEBT_MANAGEMENT]: [
        { date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), score: 65 },
        { date: new Date().toISOString(), score: 60 },
      ],
      [HealthScoreCategory.GOAL_PROGRESS]: [
        { date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), score: 75 },
        { date: new Date().toISOString(), score: 75 },
      ],
      [HealthScoreCategory.CASH_FLOW]: [
        { date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), score: 70 },
        { date: new Date().toISOString(), score: 70 },
      ],
      [HealthScoreCategory.EMERGENCY_FUND]: [
        { date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), score: 60 },
        { date: new Date().toISOString(), score: 65 },
      ],
      [HealthScoreCategory.CREDIT_UTILIZATION]: [
        { date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), score: 85 },
        { date: new Date().toISOString(), score: 85 },
      ],
      [HealthScoreCategory.INVESTMENT_DIVERSITY]: [
        { date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), score: 50 },
        { date: new Date().toISOString(), score: 50 },
      ],
    },
    milestones: [
      {
        date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Reached Good credit range',
        impact: 5,
        type: 'achievement',
      },
    ],
  };

  beforeEach(async () => {
    const mockService = {
      generateHealthScore: jest.fn(),
      getHealthScoreHistory: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthScoreController],
      providers: [
        {
          provide: FinancialHealthScoreService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<HealthScoreController>(HealthScoreController);
    service = module.get(FinancialHealthScoreService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateHealthScore', () => {
    const generateDto: GenerateHealthScoreDto = {
      force_recalculation: true,
      include_breakdown: true,
      include_benchmarks: true,
    };

    it('should generate health score successfully', async () => {
      service.generateHealthScore.mockResolvedValue(mockHealthScore);

      const result = await controller.generateHealthScore(generateDto, mockRequest);

      expect(service.generateHealthScore).toHaveBeenCalledWith(
        mockHouseholdId,
        mockUserId,
        generateDto,
      );
      expect(result).toEqual(mockHealthScore);
    });

    it('should handle BadRequestException for invalid parameters', async () => {
      service.generateHealthScore.mockRejectedValue(
        new BadRequestException('Insufficient financial data to calculate score'),
      );

      await expect(
        controller.generateHealthScore(generateDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should generate score with minimal parameters', async () => {
      const minimalDto: GenerateHealthScoreDto = {
        force_recalculation: false,
      };

      service.generateHealthScore.mockResolvedValue(mockHealthScore);

      const result = await controller.generateHealthScore(minimalDto, mockRequest);

      expect(service.generateHealthScore).toHaveBeenCalledWith(
        mockHouseholdId,
        mockUserId,
        minimalDto,
      );
      expect(result).toEqual(mockHealthScore);
    });

    it('should handle service errors during generation', async () => {
      service.generateHealthScore.mockRejectedValue(new Error('Analysis service unavailable'));

      await expect(
        controller.generateHealthScore(generateDto, mockRequest),
      ).rejects.toThrow('Analysis service unavailable');
    });
  });

  describe('getCurrentHealthScore', () => {
    it('should get current health score for requesting user', async () => {
      service.generateHealthScore.mockResolvedValue(mockHealthScore);

      const result = await controller.getCurrentHealthScore('', mockRequest);

      expect(service.generateHealthScore).toHaveBeenCalledWith(
        mockHouseholdId,
        mockUserId,
        { force_recalculation: false },
      );
      expect(result).toEqual(mockHealthScore);
    });

    it('should get current health score for specific user', async () => {
      const otherUserScore = { ...mockHealthScore };
      service.generateHealthScore.mockResolvedValue(otherUserScore);

      const result = await controller.getCurrentHealthScore(mockOtherUserId, mockRequest);

      expect(service.generateHealthScore).toHaveBeenCalledWith(
        mockHouseholdId,
        mockOtherUserId,
        { force_recalculation: false },
      );
      expect(result).toEqual(otherUserScore);
    });

    it('should handle empty string user_id parameter', async () => {
      service.generateHealthScore.mockResolvedValue(mockHealthScore);

      const result = await controller.getCurrentHealthScore('', mockRequest);

      expect(service.generateHealthScore).toHaveBeenCalledWith(
        mockHouseholdId,
        mockUserId,
        { force_recalculation: false },
      );
      expect(result).toEqual(mockHealthScore);
    });

    it('should handle NotFoundException for invalid user', async () => {
      service.generateHealthScore.mockRejectedValue(
        new NotFoundException('User not found in household'),
      );

      await expect(
        controller.getCurrentHealthScore('invalid-user-id', mockRequest),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle BadRequestException for insufficient data', async () => {
      service.generateHealthScore.mockRejectedValue(
        new BadRequestException('Insufficient financial data for user'),
      );

      await expect(
        controller.getCurrentHealthScore(mockOtherUserId, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getHealthScoreHistory', () => {
    it('should get health score history for requesting user', async () => {
      service.getHealthScoreHistory.mockResolvedValue(mockHealthScoreHistory);

      const result = await controller.getHealthScoreHistory('', mockRequest);

      expect(service.getHealthScoreHistory).toHaveBeenCalledWith(
        mockHouseholdId,
        mockUserId,
      );
      expect(result).toEqual(mockHealthScoreHistory);
    });

    it('should get health score history for specific user', async () => {
      const otherUserHistory = { ...mockHealthScoreHistory };
      service.getHealthScoreHistory.mockResolvedValue(otherUserHistory);

      const result = await controller.getHealthScoreHistory(mockOtherUserId, mockRequest);

      expect(service.getHealthScoreHistory).toHaveBeenCalledWith(
        mockHouseholdId,
        mockOtherUserId,
      );
      expect(result).toEqual(otherUserHistory);
    });

    it('should handle empty string user_id parameter', async () => {
      service.getHealthScoreHistory.mockResolvedValue(mockHealthScoreHistory);

      const result = await controller.getHealthScoreHistory('', mockRequest);

      expect(service.getHealthScoreHistory).toHaveBeenCalledWith(
        mockHouseholdId,
        mockUserId,
      );
      expect(result).toEqual(mockHealthScoreHistory);
    });

    it('should handle NotFoundException for invalid user', async () => {
      service.getHealthScoreHistory.mockRejectedValue(
        new NotFoundException('User not found in household'),
      );

      await expect(
        controller.getHealthScoreHistory('invalid-user-id', mockRequest),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle empty history gracefully', async () => {
      const emptyHistory: HealthScoreHistoryDto = {
        history: [],
        category_trends: {
          [HealthScoreCategory.BUDGETING]: [],
          [HealthScoreCategory.SAVINGS]: [],
          [HealthScoreCategory.DEBT_MANAGEMENT]: [],
          [HealthScoreCategory.GOAL_PROGRESS]: [],
          [HealthScoreCategory.CASH_FLOW]: [],
          [HealthScoreCategory.EMERGENCY_FUND]: [],
          [HealthScoreCategory.CREDIT_UTILIZATION]: [],
          [HealthScoreCategory.INVESTMENT_DIVERSITY]: [],
        },
        milestones: [],
      };
      service.getHealthScoreHistory.mockResolvedValue(emptyHistory);

      const result = await controller.getHealthScoreHistory(mockUserId, mockRequest);

      expect(service.getHealthScoreHistory).toHaveBeenCalledWith(
        mockHouseholdId,
        mockUserId,
      );
      expect(result).toEqual(emptyHistory);
    });

    it('should handle service errors during history retrieval', async () => {
      service.getHealthScoreHistory.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        controller.getHealthScoreHistory(mockUserId, mockRequest),
      ).rejects.toThrow('Database connection failed');
    });
  });
});
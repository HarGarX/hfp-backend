import { Test, TestingModule } from '@nestjs/testing';
import { InsightsController } from './insights.controller';
import { InsightsService } from '../services/insights.service';
import { CreateInsightDto, UpdateInsightDto } from '../dto';
import { Insight, InsightType, InsightStatus, InsightPriority } from '../entities/insight.entity';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('InsightsController', () => {
  let controller: InsightsController;
  let service: jest.Mocked<InsightsService>;

  const mockHouseholdId = 'household-123';
  const mockUserId = 'user-123';

  const mockRequest = {
    user: {
      userId: mockUserId,
      householdId: mockHouseholdId,
    },
  };

  const mockInsight: Partial<Insight> = {
    id: 'insight-123',
    title: 'High Spending Alert',
    description: 'Your spending increased 25% this month',
    type: InsightType.SPENDING_PATTERN,
    status: InsightStatus.ACTIVE,
    priority: InsightPriority.HIGH,
    data: {
      confidence_score: 0.85,
      analysis: { trend: 'increasing' },
    },
    household_id: mockHouseholdId,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockPagination: PaginationDto = {
    page: 1,
    limit: 20,
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      getSummary: jest.fn(),
      generateSpendingPatternInsights: jest.fn(),
      generateBudgetRecommendations: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      acknowledge: jest.fn(),
      dismiss: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InsightsController],
      providers: [
        {
          provide: InsightsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<InsightsController>(InsightsController);
    service = module.get(InsightsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateInsightDto = {
      title: 'Custom Budget Alert',
      description: 'Budget exceeded in dining category',
      type: InsightType.BUDGET_RECOMMENDATION,
      priority: InsightPriority.MEDIUM,
      data: {
        confidence_score: 0.9,
        analysis: { category: 'dining' },
      },
    };

    it('should create an insight successfully', async () => {
      service.create.mockResolvedValue(mockInsight as Insight);

      const result = await controller.create(createDto, mockRequest);

      expect(service.create).toHaveBeenCalledWith(createDto, mockUserId, mockHouseholdId);
      expect(result).toEqual(mockInsight);
    });

    it('should handle BadRequestException for invalid data', async () => {
      service.create.mockRejectedValue(new BadRequestException('Invalid insight data'));

      await expect(controller.create(createDto, mockRequest)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    const mockFilters = {
      type: InsightType.SPENDING_PATTERN,
      status: InsightStatus.ACTIVE,
      priority: InsightPriority.HIGH,
    };

    const mockInsightsResponse = {
      insights: [mockInsight],
      total: 1,
    };

    it('should return paginated insights with filters', async () => {
      service.findAll.mockResolvedValue(mockInsightsResponse as any);

      const result = await controller.findAll(mockPagination, mockFilters, mockRequest);

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, mockPagination, mockFilters);
      expect(result).toEqual(mockInsightsResponse);
    });

    it('should return insights without filters', async () => {
      const emptyFilters = {};
      service.findAll.mockResolvedValue(mockInsightsResponse as any);

      const result = await controller.findAll(mockPagination, emptyFilters, mockRequest);

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, mockPagination, emptyFilters);
      expect(result).toEqual(mockInsightsResponse);
    });
  });

  describe('getSummary', () => {
    const mockSummary = {
      total_insights: 15,
      active_insights: 8,
      dismissed_insights: 2,
      insights_by_type: {
        [InsightType.SPENDING_PATTERN]: 6,
        [InsightType.BUDGET_RECOMMENDATION]: 4,
        [InsightType.SAVINGS_OPPORTUNITY]: 3,
        [InsightType.GOAL_PROGRESS]: 2,
      },
      insights_by_priority: {
        [InsightPriority.HIGH]: 3,
        [InsightPriority.MEDIUM]: 7,
        [InsightPriority.LOW]: 5,
      },
      average_confidence_score: 0.82,
      most_recent_insight: mockInsight as Insight,
    };

    it('should return insights summary', async () => {
      service.getSummary.mockResolvedValue(mockSummary as any);

      const result = await controller.getSummary(mockRequest);

      expect(service.getSummary).toHaveBeenCalledWith(mockHouseholdId);
      expect(result).toEqual(mockSummary);
    });
  });

  describe('generateSpendingPatterns', () => {
    const mockGeneratedInsights = [
      { ...mockInsight, title: 'Increased Dining Spending' },
      { ...mockInsight, id: 'insight-456', title: 'Weekend Spending Pattern' },
    ];

    it('should generate spending pattern insights', async () => {
      service.generateSpendingPatternInsights.mockResolvedValue(mockGeneratedInsights as Insight[]);

      const result = await controller.generateSpendingPatterns(mockRequest);

      expect(service.generateSpendingPatternInsights).toHaveBeenCalledWith(mockHouseholdId);
      expect(result).toEqual(mockGeneratedInsights);
    });

    it('should handle service errors during generation', async () => {
      service.generateSpendingPatternInsights.mockRejectedValue(new Error('Insufficient data'));

      await expect(controller.generateSpendingPatterns(mockRequest)).rejects.toThrow('Insufficient data');
    });
  });

  describe('generateBudgetRecommendations', () => {
    const mockBudgetInsight = {
      ...mockInsight,
      title: 'Budget Recommendation',
      type: InsightType.BUDGET_RECOMMENDATION,
    };

    it('should generate budget recommendations', async () => {
      service.generateBudgetRecommendations.mockResolvedValue(mockBudgetInsight as Insight);

      const result = await controller.generateBudgetRecommendations(mockRequest);

      expect(service.generateBudgetRecommendations).toHaveBeenCalledWith(mockHouseholdId);
      expect(result).toEqual(mockBudgetInsight);
    });

    it('should handle service errors during generation', async () => {
      service.generateBudgetRecommendations.mockRejectedValue(new Error('Analysis failed'));

      await expect(controller.generateBudgetRecommendations(mockRequest)).rejects.toThrow('Analysis failed');
    });
  });

  describe('findOne', () => {
    it('should return an insight by id', async () => {
      service.findOne.mockResolvedValue(mockInsight as Insight);

      const result = await controller.findOne('insight-123', mockRequest);

      expect(service.findOne).toHaveBeenCalledWith('insight-123', mockHouseholdId);
      expect(result).toEqual(mockInsight);
    });

    it('should handle NotFoundException', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Insight not found'));

      await expect(controller.findOne('nonexistent-id', mockRequest)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateInsightDto = {
      status: InsightStatus.ACKNOWLEDGED,
    };

    it('should update an insight successfully', async () => {
      const updatedInsight = { ...mockInsight, ...updateDto };
      service.update.mockResolvedValue(updatedInsight as Insight);

      const result = await controller.update('insight-123', updateDto, mockRequest);

      expect(service.update).toHaveBeenCalledWith('insight-123', updateDto, mockHouseholdId);
      expect(result).toEqual(updatedInsight);
    });

    it('should handle NotFoundException', async () => {
      service.update.mockRejectedValue(new NotFoundException('Insight not found'));

      await expect(controller.update('nonexistent-id', updateDto, mockRequest)).rejects.toThrow(NotFoundException);
    });

    it('should handle BadRequestException for invalid data', async () => {
      service.update.mockRejectedValue(new BadRequestException('Invalid update data'));

      await expect(controller.update('insight-123', updateDto, mockRequest)).rejects.toThrow(BadRequestException);
    });
  });

  describe('acknowledge', () => {
    const acknowledgeDto = {
      note: 'Useful information',
    };

    it('should acknowledge an insight successfully', async () => {
      const acknowledgedInsight = { 
        ...mockInsight, 
        status: InsightStatus.ACKNOWLEDGED,
      };
      service.acknowledge.mockResolvedValue(acknowledgedInsight as Insight);

      const result = await controller.acknowledge('insight-123', acknowledgeDto, mockRequest);

      expect(service.acknowledge).toHaveBeenCalledWith('insight-123', acknowledgeDto, mockUserId, mockHouseholdId);
      expect(result).toEqual(acknowledgedInsight);
    });

    it('should handle NotFoundException', async () => {
      service.acknowledge.mockRejectedValue(new NotFoundException('Insight not found'));

      await expect(controller.acknowledge('nonexistent-id', acknowledgeDto, mockRequest)).rejects.toThrow(NotFoundException);
    });
  });

  describe('dismiss', () => {
    it('should dismiss an insight successfully', async () => {
      const dismissedInsight = { 
        ...mockInsight, 
        status: InsightStatus.DISMISSED 
      };
      service.dismiss.mockResolvedValue(dismissedInsight as Insight);

      const result = await controller.dismiss('insight-123', mockRequest);

      expect(service.dismiss).toHaveBeenCalledWith('insight-123', mockHouseholdId);
      expect(result).toEqual(dismissedInsight);
    });

    it('should handle NotFoundException', async () => {
      service.dismiss.mockRejectedValue(new NotFoundException('Insight not found'));

      await expect(controller.dismiss('nonexistent-id', mockRequest)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove an insight successfully', async () => {
      service.remove.mockResolvedValue();

      await controller.remove('insight-123', mockRequest);

      expect(service.remove).toHaveBeenCalledWith('insight-123', mockHouseholdId);
    });

    it('should handle NotFoundException', async () => {
      service.remove.mockRejectedValue(new NotFoundException('Insight not found'));

      await expect(controller.remove('nonexistent-id', mockRequest)).rejects.toThrow(NotFoundException);
    });
  });
});
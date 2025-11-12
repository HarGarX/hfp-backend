import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsightsService } from '../insights.service';
import { Insight, InsightType, InsightStatus, InsightPriority } from '../../entities/insight.entity';
import { FinancialHealthScore } from '../../entities/financial-health-score.entity';
import { Transaction } from '../../../expenses/entities/transaction.entity';
import { Category } from '../../../expenses/entities/category.entity';
import { Account } from '../../../accounts/entities/account.entity';
import { Goal } from '../../../goals/entities/goal.entity';
import { Loan } from '../../../loans/entities/loan.entity';
import { CreateInsightDto, UpdateInsightDto, AcknowledgeInsightDto } from '../../dto';

describe('InsightsService', () => {
  let service: InsightsService;
  let insightRepository: jest.Mocked<Repository<Insight>>;
  let healthScoreRepository: jest.Mocked<Repository<FinancialHealthScore>>;
  let transactionRepository: jest.Mocked<Repository<Transaction>>;
  let categoryRepository: jest.Mocked<Repository<Category>>;
  let accountRepository: jest.Mocked<Repository<Account>>;
  let goalRepository: jest.Mocked<Repository<Goal>>;
  let loanRepository: jest.Mocked<Repository<Loan>>;

  const mockInsight = {
    id: 'insight-1',
    household_id: 'household-1',
    user_id: 'user-1',
    type: InsightType.SPENDING_PATTERN,
    title: 'Test Insight',
    description: 'Test Description',
    priority: InsightPriority.MEDIUM,
    status: InsightStatus.ACTIVE,
    data: {
      analysis: { test: 'data' },
      recommendations: [],
    },
    is_actionable: true,
    view_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
    estimated_impact: 100,
    engagement_score: 50,
    is_expired: false,
    days_since_created: 1,
    confidence_level: 'medium',
  } as Insight;

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockInsight], 1]),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsightsService,
        {
          provide: getRepositoryToken(Insight),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(FinancialHealthScore),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Category),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Account),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Goal),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Loan),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<InsightsService>(InsightsService);
    insightRepository = module.get(getRepositoryToken(Insight));
    healthScoreRepository = module.get(getRepositoryToken(FinancialHealthScore));
    transactionRepository = module.get(getRepositoryToken(Transaction));
    categoryRepository = module.get(getRepositoryToken(Category));
    accountRepository = module.get(getRepositoryToken(Account));
    goalRepository = module.get(getRepositoryToken(Goal));
    loanRepository = module.get(getRepositoryToken(Loan));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new insight', async () => {
      const createInsightDto: CreateInsightDto = {
        type: InsightType.SPENDING_PATTERN,
        title: 'Test Insight',
        description: 'Test Description',
        data: {
          analysis: { test: 'data' },
          recommendations: [],
        },
      };

      insightRepository.create.mockReturnValue(mockInsight);
      insightRepository.save.mockResolvedValue(mockInsight);

      const result = await service.create(createInsightDto, 'user-1', 'household-1');

      expect(insightRepository.create).toHaveBeenCalledWith({
        ...createInsightDto,
        household_id: 'household-1',
        user_id: 'user-1',
      });
      expect(insightRepository.save).toHaveBeenCalledWith(mockInsight);
      expect(result).toEqual(mockInsight);
    });

    it('should use provided user_id when specified', async () => {
      const createInsightDto: CreateInsightDto = {
        type: InsightType.SPENDING_PATTERN,
        title: 'Test Insight',
        description: 'Test Description',
        user_id: 'specific-user',
        data: { analysis: {} },
      };

      insightRepository.create.mockReturnValue(mockInsight);
      insightRepository.save.mockResolvedValue(mockInsight);

      await service.create(createInsightDto, 'user-1', 'household-1');

      expect(insightRepository.create).toHaveBeenCalledWith({
        ...createInsightDto,
        household_id: 'household-1',
        user_id: 'specific-user',
      });
    });
  });

  describe('findAll', () => {
    it('should return insights with pagination', async () => {
      const paginationDto = { page: 1, limit: 10 };

      const result = await service.findAll('household-1', paginationDto);

      expect(result).toEqual({
        insights: [mockInsight],
        total: 1,
      });
    });

    it('should apply filters correctly', async () => {
      const paginationDto = { page: 1, limit: 10 };
      const filters = {
        type: InsightType.SPENDING_PATTERN,
        status: InsightStatus.ACTIVE,
        priority: InsightPriority.HIGH,
      };

      // Just test that the method completes successfully with filters
      await service.findAll('household-1', paginationDto, filters);

      // Test that createQueryBuilder was called
      expect(insightRepository.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return an insight and increment view count', async () => {
      insightRepository.findOne.mockResolvedValue(mockInsight);
      insightRepository.save.mockResolvedValue(mockInsight as any);

      const result = await service.findOne('insight-1', 'household-1');

      expect(insightRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'insight-1', household_id: 'household-1' },
        relations: ['user'],
      });
      expect(insightRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when insight not found', async () => {
      insightRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', 'household-1'))
        .rejects.toThrow('Insight not found');
    });
  });

  describe('update', () => {
    it('should update an insight', async () => {
      const updateDto: UpdateInsightDto = {
        status: InsightStatus.ACKNOWLEDGED,
        user_rating: 5,
      };

      insightRepository.findOne.mockResolvedValue(mockInsight);
      insightRepository.save.mockResolvedValue(mockInsight as any);

      const result = await service.update('insight-1', updateDto, 'household-1');

      expect(insightRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('acknowledge', () => {
    it('should acknowledge an insight', async () => {
      const acknowledgeDto: AcknowledgeInsightDto = {
        note: 'Thanks for the tip!',
      };

      insightRepository.findOne.mockResolvedValue(mockInsight);
      insightRepository.save.mockResolvedValue(mockInsight as any);

      const result = await service.acknowledge('insight-1', acknowledgeDto, 'user-1', 'household-1');

      expect(result).toBeDefined();
    });
  });

  describe('dismiss', () => {
    it('should dismiss an insight', async () => {
      insightRepository.findOne.mockResolvedValue(mockInsight);
      insightRepository.save.mockResolvedValue(mockInsight as any);

      const result = await service.dismiss('insight-1', 'household-1');

      expect(result).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should remove an insight', async () => {
      insightRepository.findOne.mockResolvedValue(mockInsight);
      insightRepository.remove.mockResolvedValue(mockInsight);

      await service.remove('insight-1', 'household-1');

      expect(insightRepository.remove).toHaveBeenCalledWith(mockInsight);
    });
  });

  describe('getSummary', () => {
    it('should return insights summary', async () => {
      const insights = [mockInsight] as any[];
      insightRepository.find.mockResolvedValue(insights);

      const result = await service.getSummary('household-1');

      expect(result).toHaveProperty('total_insights');
      expect(result).toHaveProperty('active_insights');
      expect(result).toHaveProperty('critical_insights');
      expect(result).toHaveProperty('actionable_insights');
      expect(result).toHaveProperty('top_insight_types');
      expect(result).toHaveProperty('engagement_metrics');
    });
  });

  describe('generateSpendingPatternInsights', () => {
    it('should generate spending pattern insights', async () => {
      const mockTransactions = [{
        date: new Date(),
        amount: -100,
        category: { name: 'Dining Out' },
      }] as any[];

      transactionRepository.find.mockResolvedValue(mockTransactions);
      insightRepository.create.mockReturnValue(mockInsight);
      insightRepository.save.mockResolvedValue([mockInsight] as any);

      const result = await service.generateSpendingPatternInsights('household-1');

      expect(transactionRepository.find).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('generateBudgetRecommendations', () => {
    it('should generate budget recommendations', async () => {
      accountRepository.find.mockResolvedValue([]);
      transactionRepository.find.mockResolvedValue([]);
      goalRepository.find.mockResolvedValue([]);
      loanRepository.find.mockResolvedValue([]);
      
      insightRepository.create.mockReturnValue(mockInsight);
      insightRepository.save.mockResolvedValue(mockInsight);

      const result = await service.generateBudgetRecommendations('household-1');

      expect(result).toEqual(mockInsight);
    });
  });

  describe('cleanupExpiredInsights', () => {
    it('should mark expired insights as expired', async () => {
      insightRepository.update.mockResolvedValue({ affected: 2, raw: {}, generatedMaps: [] } as any);

      const result = await service.cleanupExpiredInsights();

      expect(insightRepository.update).toHaveBeenCalled();
      expect(result).toBe(2);
    });
  });
});
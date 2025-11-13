import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { FinancialHealthScoreService } from '../financial-health-score.service';
import { FinancialHealthScore, HealthScoreCategory } from '../../entities/financial-health-score.entity';
import { Transaction } from '../../../expenses/entities/transaction.entity';
import { Account } from '../../../accounts/entities/account.entity';
import { Goal } from '../../../goals/entities/goal.entity';
import { Loan } from '../../../loans/entities/loan.entity';

describe('FinancialHealthScoreService', () => {
  let service: FinancialHealthScoreService;
  let healthScoreRepository: jest.Mocked<Repository<FinancialHealthScore>>;
  let transactionRepository: jest.Mocked<Repository<Transaction>>;
  let accountRepository: jest.Mocked<Repository<Account>>;
  let goalRepository: jest.Mocked<Repository<Goal>>;
  let loanRepository: jest.Mocked<Repository<Loan>>;

  const mockHouseholdId = '123e4567-e89b-12d3-a456-426614174000';
  const mockUserId = '123e4567-e89b-12d3-a456-426614174001';

  const createMockHealthScore = (overrides = {}) => ({
    id: '1',
    household_id: mockHouseholdId,
    user_id: mockUserId,
    overall_score: 75,
    category_scores: {
      [HealthScoreCategory.BUDGETING]: {
        score: 80,
        weight: 0.15,
        trends: { trend_direction: 'stable' as const },
        recommendations: [],
      },
      [HealthScoreCategory.SAVINGS]: {
        score: 70,
        weight: 0.20,
        trends: { trend_direction: 'up' as const },
        recommendations: [],
      },
      [HealthScoreCategory.DEBT_MANAGEMENT]: {
        score: 65,
        weight: 0.20,
        trends: { trend_direction: 'stable' as const },
        recommendations: [],
      },
      [HealthScoreCategory.GOAL_PROGRESS]: {
        score: 60,
        weight: 0.15,
        trends: { trend_direction: 'stable' as const },
        recommendations: [],
      },
      [HealthScoreCategory.CASH_FLOW]: {
        score: 75,
        weight: 0.15,
        trends: { trend_direction: 'stable' as const },
        recommendations: [],
      },
      [HealthScoreCategory.EMERGENCY_FUND]: {
        score: 50,
        weight: 0.15,
        trends: { trend_direction: 'stable' as const },
        recommendations: [],
      },
      [HealthScoreCategory.CREDIT_UTILIZATION]: {
        score: 70,
        weight: 0.0,
        trends: { trend_direction: 'stable' as const },
        recommendations: [],
      },
      [HealthScoreCategory.INVESTMENT_DIVERSITY]: {
        score: 50,
        weight: 0.0,
        trends: { trend_direction: 'stable' as const },
        recommendations: [],
      },
    },
    metrics: {
      income_stability: 0.85,
      expense_ratio: 0.7,
      savings_rate: 0.3,
      debt_to_income_ratio: 0.25,
      emergency_fund_months: 2.5,
      credit_utilization: 0.3,
      on_time_payments: 0.95,
      active_goals_count: 2,
      goal_completion_rate: 0.5,
      cash_flow_volatility: 0.8,
      recurring_income_percentage: 0.8,
      budget_adherence: 0.85,
      transaction_categorization_accuracy: 0.9,
      financial_app_engagement: 0.7,
    },
    benchmarks: {
      peer_group: { age_range: '25-34', income_range: '$50k-$75k', household_size: 2 },
      percentile_ranking: 75,
      top_improvement_areas: ['Emergency Fund', 'Debt Management'],
      strengths: ['Income Stability', 'Goal Setting'],
    },
    model_version: 'health_score_v1.0.0',
    calculated_at: new Date('2024-01-15T10:00:00Z'),
    next_calculation_at: new Date('2024-01-22T10:00:00Z'),
    created_at: new Date('2024-01-15T10:00:00Z'),
    updated_at: new Date('2024-01-15T10:00:00Z'),
    score_grade: 'Good',
    improvement_trend: 'stable' as const,
    top_strength: HealthScoreCategory.SAVINGS,
    biggest_opportunity: HealthScoreCategory.EMERGENCY_FUND,
    weighted_average_score: 75,
    ...overrides,
  });

  const mockAccounts = [
    {
      id: '1',
      household_id: mockHouseholdId,
      current_balance: 5000,
      account_type: 'checking',
    },
    {
      id: '2',
      household_id: mockHouseholdId,
      current_balance: 15000,
      account_type: 'savings',
    },
  ];

  const mockTransactions = [
    {
      id: '1',
      household_id: mockHouseholdId,
      amount: 5000, // Income
      date: new Date('2024-01-01'),
      category: { id: '1', name: 'Salary' },
      category_id: '1',
    },
    {
      id: '2',
      household_id: mockHouseholdId,
      amount: -1500, // Expense
      date: new Date('2024-01-02'),
      category: { id: '2', name: 'Rent' },
      category_id: '2',
    },
    {
      id: '3',
      household_id: mockHouseholdId,
      amount: -800, // Expense
      date: new Date('2024-01-03'),
      category: { id: '3', name: 'Groceries' },
      category_id: '3',
    },
  ];

  const mockGoals = [
    {
      id: '1',
      household_id: mockHouseholdId,
      status: 'active' as const,
      target_amount: 10000,
      current_amount: 5000,
    },
    {
      id: '2',
      household_id: mockHouseholdId,
      status: 'completed' as const,
      target_amount: 5000,
      current_amount: 5000,
    },
  ];

  const mockLoans = [
    {
      id: '1',
      household_id: mockHouseholdId,
      current_balance: 15000,
      monthly_payment_equivalent: 350,
    },
    {
      id: '2',
      household_id: mockHouseholdId,
      current_balance: 25000,
      monthly_payment_equivalent: 450,
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialHealthScoreService,
        {
          provide: getRepositoryToken(FinancialHealthScore),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Account),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Goal),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Loan),
          useValue: {
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FinancialHealthScoreService>(FinancialHealthScoreService);
    healthScoreRepository = module.get(getRepositoryToken(FinancialHealthScore));
    transactionRepository = module.get(getRepositoryToken(Transaction));
    accountRepository = module.get(getRepositoryToken(Account));
    goalRepository = module.get(getRepositoryToken(Goal));
    loanRepository = module.get(getRepositoryToken(Loan));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateHealthScore', () => {
    it('should return recent health score when available and force_recalculation is false', async () => {
      const mockHealthScore = createMockHealthScore();
      healthScoreRepository.findOne.mockResolvedValue(mockHealthScore as any);

      const result = await service.generateHealthScore(mockHouseholdId, mockUserId);

      expect(result).toMatchObject({
        overall_score: mockHealthScore.overall_score,
        score_grade: mockHealthScore.score_grade,
        improvement_trend: mockHealthScore.improvement_trend,
        top_strength: mockHealthScore.top_strength,
        biggest_opportunity: mockHealthScore.biggest_opportunity,
        category_scores: mockHealthScore.category_scores,
        metrics: mockHealthScore.metrics,
        benchmarks: mockHealthScore.benchmarks,
        calculated_at: mockHealthScore.calculated_at.toISOString(),
        next_calculation_at: mockHealthScore.next_calculation_at?.toISOString(),
      });
      expect(healthScoreRepository.findOne).toHaveBeenCalledWith({
        where: {
          household_id: mockHouseholdId,
          user_id: mockUserId,
          calculated_at: expect.any(Object), // MoreThan instance
        },
        order: { calculated_at: 'DESC' },
      });
    });

    it('should calculate new health score when force_recalculation is true', async () => {
      const newHealthScore = createMockHealthScore({ overall_score: 80 });
      healthScoreRepository.create.mockReturnValue(newHealthScore as any);
      healthScoreRepository.save.mockResolvedValue(newHealthScore as any);
      accountRepository.find.mockResolvedValue(mockAccounts as any);
      transactionRepository.find.mockResolvedValue(mockTransactions as any);
      goalRepository.find.mockResolvedValue(mockGoals as any);
      loanRepository.find.mockResolvedValue(mockLoans as any);

      const result = await service.generateHealthScore(mockHouseholdId, mockUserId, {
        force_recalculation: true,
      });

      expect(result.overall_score).toBe(80);
      expect(healthScoreRepository.save).toHaveBeenCalledWith(newHealthScore);
    });

    it('should calculate new health score when no recent score exists', async () => {
      const mockHealthScore = createMockHealthScore();
      healthScoreRepository.findOne.mockResolvedValue(null);
      healthScoreRepository.create.mockReturnValue(mockHealthScore as any);
      healthScoreRepository.save.mockResolvedValue(mockHealthScore as any);
      accountRepository.find.mockResolvedValue(mockAccounts as any);
      transactionRepository.find.mockResolvedValue(mockTransactions as any);
      goalRepository.find.mockResolvedValue(mockGoals as any);
      loanRepository.find.mockResolvedValue(mockLoans as any);

      const result = await service.generateHealthScore(mockHouseholdId);

      expect(result.overall_score).toBe(75);
      expect(healthScoreRepository.create).toHaveBeenCalled();
      expect(healthScoreRepository.save).toHaveBeenCalled();
    });

    it('should handle health score calculation without userId', async () => {
      const mockHealthScore = createMockHealthScore();
      healthScoreRepository.findOne.mockResolvedValue(null);
      healthScoreRepository.create.mockReturnValue(mockHealthScore as any);
      healthScoreRepository.save.mockResolvedValue(mockHealthScore as any);
      accountRepository.find.mockResolvedValue(mockAccounts as any);
      transactionRepository.find.mockResolvedValue(mockTransactions as any);
      goalRepository.find.mockResolvedValue(mockGoals as any);
      loanRepository.find.mockResolvedValue(mockLoans as any);

      await service.generateHealthScore(mockHouseholdId);

      expect(transactionRepository.find).toHaveBeenCalledWith({
        where: {
          household_id: mockHouseholdId,
          date: expect.any(Object), // MoreThan instance
        },
        relations: ['category'],
      });
    });

    it('should handle empty financial data', async () => {
      const mockHealthScore = createMockHealthScore();
      healthScoreRepository.findOne.mockResolvedValue(null);
      healthScoreRepository.create.mockReturnValue(mockHealthScore as any);
      healthScoreRepository.save.mockResolvedValue(mockHealthScore as any);
      accountRepository.find.mockResolvedValue([]);
      transactionRepository.find.mockResolvedValue([]);
      goalRepository.find.mockResolvedValue([]);
      loanRepository.find.mockResolvedValue([]);

      const result = await service.generateHealthScore(mockHouseholdId);

      expect(result).toBeDefined();
      expect(result.overall_score).toBeGreaterThanOrEqual(0);
      expect(result.overall_score).toBeLessThanOrEqual(100);
    });

    it('should handle single income transaction for income stability', async () => {
      const singleTransaction = [mockTransactions[0]];
      const mockHealthScore = createMockHealthScore();
      healthScoreRepository.findOne.mockResolvedValue(null);
      healthScoreRepository.create.mockReturnValue(mockHealthScore as any);
      healthScoreRepository.save.mockResolvedValue(mockHealthScore as any);
      accountRepository.find.mockResolvedValue(mockAccounts as any);
      transactionRepository.find.mockResolvedValue(singleTransaction as any);
      goalRepository.find.mockResolvedValue(mockGoals as any);
      loanRepository.find.mockResolvedValue(mockLoans as any);

      const result = await service.generateHealthScore(mockHouseholdId);

      expect(result).toBeDefined();
    });
  });

  describe('getHealthScoreHistory', () => {
    const mockHistoryScores = [
      createMockHealthScore({
        id: '1',
        overall_score: 70,
        calculated_at: new Date('2024-01-01T10:00:00Z'),
        improvement_trend: 'stable',
      }),
      createMockHealthScore({
        id: '2',
        overall_score: 75,
        calculated_at: new Date('2024-01-08T10:00:00Z'),
        improvement_trend: 'improving',
      }),
      createMockHealthScore({
        id: '3',
        overall_score: 80,
        calculated_at: new Date('2024-01-15T10:00:00Z'),
        improvement_trend: 'improving',
      }),
    ];

    it('should return health score history for household', async () => {
      healthScoreRepository.find.mockResolvedValue(mockHistoryScores as any);

      const result = await service.getHealthScoreHistory(mockHouseholdId);

      expect(result).toMatchObject({
        history: expect.arrayContaining([
          {
            date: '2024-01-01',
            overall_score: 70,
            score_grade: 'Good',
            trend: 'stable',
          },
          {
            date: '2024-01-08',
            overall_score: 75,
            score_grade: 'Good',
            trend: 'improving',
          },
          {
            date: '2024-01-15',
            overall_score: 80,
            score_grade: 'Good',
            trend: 'improving',
          },
        ]),
        category_trends: expect.objectContaining({
          [HealthScoreCategory.BUDGETING]: expect.arrayContaining([
            expect.objectContaining({
              date: '2024-01-01',
              score: 80,
            }),
          ]),
        }),
        milestones: expect.any(Array), // Milestones depend on score changes >= 10 points
      });
    });

    it('should return history with user filter when userId provided', async () => {
      healthScoreRepository.find.mockResolvedValue(mockHistoryScores as any);

      await service.getHealthScoreHistory(mockHouseholdId, mockUserId);

      expect(healthScoreRepository.find).toHaveBeenCalledWith({
        where: {
          household_id: mockHouseholdId,
          user_id: mockUserId,
        },
        order: { calculated_at: 'DESC' },
        take: 12,
      });
    });

    it('should handle empty history', async () => {
      healthScoreRepository.find.mockResolvedValue([]);

      const result = await service.getHealthScoreHistory(mockHouseholdId);

      expect(result).toEqual({
        history: [],
        category_trends: expect.objectContaining({
          [HealthScoreCategory.BUDGETING]: [],
          [HealthScoreCategory.SAVINGS]: [],
          [HealthScoreCategory.DEBT_MANAGEMENT]: [],
          [HealthScoreCategory.GOAL_PROGRESS]: [],
          [HealthScoreCategory.CASH_FLOW]: [],
          [HealthScoreCategory.EMERGENCY_FUND]: [],
          [HealthScoreCategory.CREDIT_UTILIZATION]: [],
          [HealthScoreCategory.INVESTMENT_DIVERSITY]: [],
        }),
        milestones: [],
      });
    });

    it('should identify significant score changes as milestones', async () => {
      const scoresWithBigChange = [
        createMockHealthScore({
          overall_score: 50,
          calculated_at: new Date('2024-01-01T10:00:00Z'),
          improvement_trend: 'declining',
        }),
        createMockHealthScore({
          overall_score: 85, // 35 point jump
          calculated_at: new Date('2024-01-08T10:00:00Z'),
          improvement_trend: 'improving',
        }),
      ];

      healthScoreRepository.find.mockResolvedValue(scoresWithBigChange as any);

      const result = await service.getHealthScoreHistory(mockHouseholdId);

      // The logic compares adjacent scores in the reversed array (oldest first)
      // So the milestone would be created for the second score (85) compared to first (50)
      expect(result.milestones).toContainEqual(
        expect.objectContaining({
          date: expect.any(String),
          description: expect.stringContaining('Health score'),
          impact: expect.any(Number),
          type: expect.stringMatching(/improvement|decline/),
        })
      );
    });

    it('should handle declining trends in milestones', async () => {
      const scoresWithDecline = [
        createMockHealthScore({
          overall_score: 80,
          calculated_at: new Date('2024-01-01T10:00:00Z'),
          improvement_trend: 'stable',
        }),
        createMockHealthScore({
          overall_score: 65, // 15 point drop
          calculated_at: new Date('2024-01-08T10:00:00Z'),
          improvement_trend: 'declining',
        }),
      ];

      healthScoreRepository.find.mockResolvedValue(scoresWithDecline as any);

      const result = await service.getHealthScoreHistory(mockHouseholdId);

      // The logic compares adjacent scores, expects decline milestone
      expect(result.milestones).toContainEqual(
        expect.objectContaining({
          date: expect.any(String),
          description: expect.stringContaining('declined'),
          impact: expect.any(Number),
          type: 'decline',
        })
      );
    });
  });

  describe('metric calculations', () => {
    beforeEach(() => {
      const mockHealthScore = createMockHealthScore();
      healthScoreRepository.findOne.mockResolvedValue(null);
      healthScoreRepository.create.mockReturnValue(mockHealthScore as any);
      healthScoreRepository.save.mockResolvedValue(mockHealthScore as any);
      accountRepository.find.mockResolvedValue(mockAccounts as any);
      transactionRepository.find.mockResolvedValue(mockTransactions as any);
      goalRepository.find.mockResolvedValue(mockGoals as any);
      loanRepository.find.mockResolvedValue(mockLoans as any);
    });

    it('should calculate metrics with income and expense data', async () => {
      const result = await service.generateHealthScore(mockHouseholdId, mockUserId);

      expect(healthScoreRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.objectContaining({
            income_stability: expect.any(Number),
            expense_ratio: expect.any(Number),
            savings_rate: expect.any(Number),
            debt_to_income_ratio: expect.any(Number),
            emergency_fund_months: expect.any(Number),
          }),
        }),
      );
    });

    it('should calculate category scores correctly', async () => {
      const result = await service.generateHealthScore(mockHouseholdId, mockUserId);

      expect(healthScoreRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          category_scores: expect.objectContaining({
            [HealthScoreCategory.BUDGETING]: expect.objectContaining({
              score: expect.any(Number),
              weight: 0.15,
              recommendations: expect.any(Array),
            }),
            [HealthScoreCategory.SAVINGS]: expect.objectContaining({
              score: expect.any(Number),
              weight: 0.20,
              recommendations: expect.any(Array),
            }),
            [HealthScoreCategory.DEBT_MANAGEMENT]: expect.objectContaining({
              score: expect.any(Number),
              weight: 0.20,
              recommendations: expect.any(Array),
            }),
          }),
        }),
      );
    });

    it('should calculate overall score based on category weights', async () => {
      const result = await service.generateHealthScore(mockHouseholdId, mockUserId);

      expect(result.overall_score).toBeGreaterThanOrEqual(0);
      expect(result.overall_score).toBeLessThanOrEqual(100);
    });

    it('should handle edge cases with zero income', async () => {
      const noIncomeTransactions = mockTransactions.filter(t => t.amount < 0);
      transactionRepository.find.mockResolvedValue(noIncomeTransactions as any);

      const result = await service.generateHealthScore(mockHouseholdId);

      expect(result).toBeDefined();
      expect(result.overall_score).toBeGreaterThanOrEqual(0);
    });

    it('should calculate cash flow volatility with varying monthly flows', async () => {
      const varyingTransactions = [
        { ...mockTransactions[0], amount: 5000, date: new Date('2024-01-01') },
        { ...mockTransactions[1], amount: -2000, date: new Date('2024-01-15') },
        { ...mockTransactions[0], amount: 3000, date: new Date('2024-02-01') },
        { ...mockTransactions[1], amount: -1500, date: new Date('2024-02-15') },
      ];
      transactionRepository.find.mockResolvedValue(varyingTransactions as any);

      const result = await service.generateHealthScore(mockHouseholdId, mockUserId);

      expect(result).toBeDefined();
      expect(healthScoreRepository.create).toHaveBeenCalled();
    });

    it('should handle single month of transaction data', async () => {
      const singleMonthTransactions = mockTransactions.map(t => ({
        ...t,
        date: new Date('2024-01-01'),
      }));
      transactionRepository.find.mockResolvedValue(singleMonthTransactions as any);

      const result = await service.generateHealthScore(mockHouseholdId, mockUserId);

      expect(result).toBeDefined();
    });

    it('should generate recommendations for low performance categories', async () => {
      // Test with empty goals to trigger goal recommendations
      goalRepository.find.mockResolvedValue([]);

      const result = await service.generateHealthScore(mockHouseholdId, mockUserId);

      const createCall = healthScoreRepository.create.mock.calls[0][0];
      expect(createCall).toHaveProperty('category_scores');
      
      const goalCategory = createCall.category_scores?.[HealthScoreCategory.GOAL_PROGRESS];
      expect(goalCategory).toHaveProperty('recommendations');
      expect(goalCategory?.recommendations).toEqual(['Set 1-3 financial goals']);
    });

    it('should generate emergency fund recommendations for insufficient funds', async () => {
      const lowBalanceAccounts = [
        {
          id: '1',
          household_id: mockHouseholdId,
          current_balance: 1000, // Low balance
          account_type: 'checking',
          name: 'Test Account',
          status: 'active',
          available_balance: 1000,
          currency: 'USD',
          institution_name: 'Test Bank',
          last_sync_date: new Date(),
        },
      ];
      accountRepository.find.mockResolvedValue(lowBalanceAccounts as any);

      const result = await service.generateHealthScore(mockHouseholdId, mockUserId);

      const createCall = healthScoreRepository.create.mock.calls[0][0];
      const emergencyCategory = createCall.category_scores?.[HealthScoreCategory.EMERGENCY_FUND];
      
      expect(emergencyCategory).toHaveProperty('recommendations');
      expect(emergencyCategory?.recommendations).toContain('Build emergency fund to 3-6 months expenses');
    });
  });

  describe('benchmarks calculation', () => {
    beforeEach(() => {
      const mockHealthScore = createMockHealthScore();
      healthScoreRepository.findOne.mockResolvedValue(null);
      healthScoreRepository.create.mockReturnValue(mockHealthScore as any);
      healthScoreRepository.save.mockResolvedValue(mockHealthScore as any);
      accountRepository.find.mockResolvedValue(mockAccounts as any);
      transactionRepository.find.mockResolvedValue(mockTransactions as any);
      goalRepository.find.mockResolvedValue(mockGoals as any);
      loanRepository.find.mockResolvedValue(mockLoans as any);
    });

    it('should generate appropriate benchmarks', async () => {
      const result = await service.generateHealthScore(mockHouseholdId, mockUserId);

      const createCall = healthScoreRepository.create.mock.calls[0][0];
      expect(createCall.benchmarks).toEqual(
        expect.objectContaining({
          peer_group: expect.objectContaining({
            age_range: expect.any(String),
            income_range: expect.any(String),
            household_size: expect.any(Number),
          }),
          percentile_ranking: expect.any(Number),
          top_improvement_areas: expect.any(Array),
          strengths: expect.any(Array),
        }),
      );
    });

    it('should clamp percentile ranking between 5 and 95', async () => {
      const mockHealthScore = createMockHealthScore();
      healthScoreRepository.create.mockReturnValue(mockHealthScore as any);

      await service.generateHealthScore(mockHouseholdId, mockUserId);

      const createCall = healthScoreRepository.create.mock.calls[0][0];
      expect(createCall.benchmarks?.percentile_ranking).toBeGreaterThanOrEqual(5);
      expect(createCall.benchmarks?.percentile_ranking).toBeLessThanOrEqual(95);
    });
  });
});
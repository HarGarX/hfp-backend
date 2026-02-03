import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CacheService } from '../../../libs/cache';
import { Between, LessThan, MoreThan } from 'typeorm';
import { Insight, InsightType, InsightStatus, InsightPriority } from '../entities/insight.entity';
import { FinancialHealthScore, HealthScoreCategory } from '../entities/financial-health-score.entity';
import {
  CreateInsightDto,
  UpdateInsightDto,
  InsightFiltersDto,
  InsightSummaryDto,
  AcknowledgeInsightDto,
} from '../dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';

// Import related entities for analysis
import { Transaction } from '../../expenses/entities/transaction.entity';
import { Category } from '../../expenses/entities/category.entity';
import { Account } from '../../accounts/entities/account.entity';
import { Goal } from '../../goals/entities/goal.entity';
import { Loan } from '../../loans/entities/loan.entity';

// Import repositories
import { InsightRepository } from '../repositories/insight.repository';
import { FinancialHealthScoreRepository } from '../repositories/financial-health-score.repository';
import { TransactionRepository } from '../../expenses/repositories/transaction.repository';
import { CategoryRepository } from '../../expenses/repositories/category.repository';
import { AccountsRepository } from '../../accounts/repositories/accounts.repository';
import { GoalRepository } from '../../goals/repositories/goal.repository';
import { LoanRepository } from '../../loans/repositories/loan.repository';

@Injectable()
export class InsightsService {
  private readonly CACHE_TTL = 600; // 10 minutes (insights change less frequently)
  
  constructor(
    private readonly insightRepository: InsightRepository,
    private readonly healthScoreRepository: FinancialHealthScoreRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly accountRepository: AccountsRepository,
    private readonly goalRepository: GoalRepository,
    private readonly loanRepository: LoanRepository,
    private readonly cacheService: CacheService,
  ) {}

  async create(
    createInsightDto: CreateInsightDto,
    userId: string,
    householdId: string,
  ): Promise<Insight> {
    const insight = this.insightRepository.create({
      ...createInsightDto,
      household_id: householdId,
      user_id: createInsightDto.user_id || userId,
    });

    const savedInsight = await this.insightRepository.saveWithHousehold(householdId, insight);
    
    // Invalidate insights cache
    await this.cacheService.del(householdId, 'insights:list');
    await this.cacheService.del(householdId, 'insights:summary');
    
    return savedInsight;
  }

  async findAll(
    householdId: string,
    paginationDto: PaginationDto,
    filters?: InsightFiltersDto,
  ): Promise<{ insights: Insight[]; total: number }> {
    const queryBuilder = this.insightRepository
      .createQueryBuilderWithHousehold(householdId, 'insight')
      .leftJoinAndSelect('insight.user', 'user');

    // Apply filters
    if (filters?.type) {
      queryBuilder.andWhere('insight.type = :type', { type: filters.type });
    }

    if (filters?.priority) {
      queryBuilder.andWhere('insight.priority = :priority', { priority: filters.priority });
    }

    if (filters?.status) {
      queryBuilder.andWhere('insight.status = :status', { status: filters.status });
    }

    if (filters?.user_id) {
      queryBuilder.andWhere('insight.user_id = :userId', { userId: filters.user_id });
    }

    if (filters?.actionable_only) {
      queryBuilder.andWhere('insight.is_actionable = :actionable', { actionable: true });
    }

    if (filters?.created_after) {
      queryBuilder.andWhere('insight.created_at >= :createdAfter', { 
        createdAfter: filters.created_after 
      });
    }

    if (filters?.created_before) {
      queryBuilder.andWhere('insight.created_at <= :createdBefore', { 
        createdBefore: filters.created_before 
      });
    }

    if (filters?.min_confidence) {
      queryBuilder.andWhere('insight.data->>\'confidence_score\' >= :minConfidence', {
        minConfidence: filters.min_confidence.toString(),
      });
    }

    // Exclude expired insights by default
    queryBuilder.andWhere('(insight.expires_at IS NULL OR insight.expires_at > :now)', {
      now: new Date(),
    });

    queryBuilder
      .orderBy('insight.priority', 'DESC')
      .addOrderBy('insight.created_at', 'DESC')
      .skip((paginationDto.page! - 1) * paginationDto.limit!)
      .take(paginationDto.limit!);

    const [insights, total] = await queryBuilder.getManyAndCount();

    return { insights, total };
  }

  async findOne(id: string, householdId: string): Promise<Insight> {
    // Try cache first
    const cacheKey = `insights:${id}`;
    const cached = await this.cacheService.get<Insight>(householdId, cacheKey);
    
    if (cached) {
      // Still track view even with cache
      cached.view_count += 1;
      cached.last_viewed_at = new Date();
      await this.insightRepository.saveWithHousehold(householdId, cached);
      return cached;
    }
    
    const insight = await this.insightRepository.findOneWithHousehold(
      householdId,
      {
        where: { id },
        relations: ['user'],
      },
    );

    if (!insight) {
      throw new NotFoundException('Insight not found');
    }

    // Track view
    insight.view_count += 1;
    insight.last_viewed_at = new Date();
    await this.insightRepository.saveWithHousehold(householdId, insight);

    // Cache the result
    await this.cacheService.set(householdId, cacheKey, insight, this.CACHE_TTL);

    return insight;
  }

  async update(
    id: string,
    updateInsightDto: UpdateInsightDto,
    householdId: string,
  ): Promise<Insight> {
    const insight = await this.findOne(id, householdId);

    Object.assign(insight, updateInsightDto);

    const updated = await this.insightRepository.saveWithHousehold(householdId, insight);
    
    // Invalidate cache
    await this.cacheService.del(householdId, `insights:${id}`);
    await this.cacheService.del(householdId, 'insights:list');
    await this.cacheService.del(householdId, 'insights:summary');
    
    return updated;
  }

  async acknowledge(
    id: string,
    acknowledgeDto: AcknowledgeInsightDto,
    userId: string,
    householdId: string,
  ): Promise<Insight> {
    const insight = await this.findOne(id, householdId);

    insight.status = InsightStatus.ACKNOWLEDGED;
    insight.acknowledged_at = new Date();
    insight.acknowledged_by = userId;

    if (acknowledgeDto.note) {
      // Store note in analysis section
      insight.data = {
        ...insight.data,
        analysis: {
          ...insight.data.analysis,
          acknowledgment_note: acknowledgeDto.note,
        },
      };
    }

    const updated = await this.insightRepository.saveWithHousehold(householdId, insight);

    // Invalidate caches
    await this.cacheService.del(householdId, `insights:${id}`);
    await this.cacheService.del(householdId, 'insights:list');
    await this.cacheService.del(householdId, 'insights:summary');

    return updated;
  }

  async dismiss(id: string, householdId: string): Promise<Insight> {
    const insight = await this.findOne(id, householdId);
    
    insight.status = InsightStatus.DISMISSED;
    
    const updated = await this.insightRepository.saveWithHousehold(householdId, insight);

    // Invalidate caches
    await this.cacheService.del(householdId, `insights:${id}`);
    await this.cacheService.del(householdId, 'insights:list');
    await this.cacheService.del(householdId, 'insights:summary');

    return updated;
  }

  async remove(id: string, householdId: string): Promise<void> {
    const insight = await this.findOne(id, householdId);
    await this.insightRepository.removeWithHousehold(householdId, insight);

    // Invalidate caches
    await this.cacheService.del(householdId, `insights:${id}`);
    await this.cacheService.del(householdId, 'insights:list');
    await this.cacheService.del(householdId, 'insights:summary');
  }

  async getSummary(householdId: string): Promise<InsightSummaryDto> {
    return this.cacheService.wrap(
      householdId,
      'insights:summary',
      async () => {
        const insights = await this.insightRepository.findWithHousehold(householdId, {});

        const totalInsights = insights.length;
        const activeInsights = insights.filter(i => i.status === InsightStatus.ACTIVE).length;
        const criticalInsights = insights.filter(i => i.priority === InsightPriority.CRITICAL).length;
        const actionableInsights = insights.filter(i => i.is_actionable).length;

        // Calculate average rating
        const ratedInsights = insights.filter(i => i.user_rating);
        const averageRating = ratedInsights.length > 0 
          ? ratedInsights.reduce((sum, i) => sum + i.user_rating!, 0) / ratedInsights.length 
          : 0;

        // Calculate total potential savings
        const totalPotentialSavings = insights.reduce((total, insight) => {
          return total + insight.estimated_impact;
        }, 0);

        // Top insight types
        const typeCount: Record<string, number> = {};
        insights.forEach(insight => {
          typeCount[insight.type] = (typeCount[insight.type] || 0) + 1;
        });

        const topInsightTypes = Object.entries(typeCount)
          .map(([type, count]) => ({
            type: type as InsightType,
            count,
            percentage: (count / totalInsights) * 100,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Engagement metrics
        const acknowledgedInsights = insights.filter(i => i.acknowledged_at).length;
        const dismissedInsights = insights.filter(i => i.status === InsightStatus.DISMISSED).length;
        const totalViews = insights.reduce((sum, i) => sum + i.view_count, 0);
        const averageViewsPerInsight = totalInsights > 0 ? totalViews / totalInsights : 0;

        // Calculate average time to acknowledgment
        const acknowledgedWithTimes = insights.filter(i => i.acknowledged_at);
        const averageTimeToAcknowledgment = acknowledgedWithTimes.length > 0
          ? acknowledgedWithTimes.reduce((sum, insight) => {
              const ackTime = new Date(insight.acknowledged_at!).getTime();
              const createTime = new Date(insight.created_at).getTime();
              return sum + (ackTime - createTime);
            }, 0) / acknowledgedWithTimes.length / (1000 * 60 * 60) // Convert to hours
          : 0;

        // Generation trend
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        const thisWeekInsights = insights.filter(i => 
          new Date(i.created_at) >= oneWeekAgo
        ).length;
        const lastWeekInsights = insights.filter(i => 
          new Date(i.created_at) >= twoWeeksAgo && new Date(i.created_at) < oneWeekAgo
        ).length;

        const changePercentage = lastWeekInsights > 0 
          ? ((thisWeekInsights - lastWeekInsights) / lastWeekInsights) * 100 
          : 0;

        return {
          total_insights: totalInsights,
          active_insights: activeInsights,
          critical_insights: criticalInsights,
          actionable_insights: actionableInsights,
          average_rating: averageRating,
          total_potential_savings: totalPotentialSavings,
          top_insight_types: topInsightTypes,
          engagement_metrics: {
            average_views_per_insight: averageViewsPerInsight,
            acknowledgment_rate: totalInsights > 0 ? (acknowledgedInsights / totalInsights) * 100 : 0,
            dismissal_rate: totalInsights > 0 ? (dismissedInsights / totalInsights) * 100 : 0,
            average_time_to_acknowledgment_hours: averageTimeToAcknowledgment,
          },
          generation_trend: {
            this_week: thisWeekInsights,
            last_week: lastWeekInsights,
            change_percentage: changePercentage,
          },
        };
      },
      this.CACHE_TTL,
    );
  }

  async generateSpendingPatternInsights(householdId: string): Promise<Insight[]> {
    // Get last 3 months of transactions
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const transactions = await this.transactionRepository.findWithHousehold(householdId, {
      where: {
        date: MoreThan(threeMonthsAgo),
      },
      relations: ['category'],
      order: { date: 'DESC' },
    });

    const insights: Insight[] = [];

    // Analyze spending by category
    const categorySpending: Record<string, { current: number; previous: number }> = {};
    const currentMonth = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    for (const transaction of transactions) {
      const categoryName = transaction.category?.name || 'Uncategorized';
      const transactionDate = new Date(transaction.date);
      const amount = Math.abs(Number(transaction.amount));

      if (!categorySpending[categoryName]) {
        categorySpending[categoryName] = { current: 0, previous: 0 };
      }

      if (transactionDate.getMonth() === currentMonth.getMonth()) {
        categorySpending[categoryName].current += amount;
      } else if (transactionDate.getMonth() === lastMonth.getMonth()) {
        categorySpending[categoryName].previous += amount;
      }
    }

    // Find significant changes
    for (const [category, spending] of Object.entries(categorySpending)) {
      const increase = spending.current - spending.previous;
      const percentIncrease = spending.previous > 0 ? (increase / spending.previous) * 100 : 0;

      // Generate insight for significant increases (>30%)
      if (percentIncrease > 30 && increase > 50) {
        const insight = this.insightRepository.create({
          type: InsightType.SPENDING_PATTERN,
          title: `High ${category} Spending Detected`,
          description: `Your ${category} expenses have increased by ${percentIncrease.toFixed(1)}% (${increase.toFixed(2)}) compared to last month.`,
          priority: increase > 200 ? InsightPriority.HIGH : InsightPriority.MEDIUM,
          household_id: householdId,
          data: {
            analysis: {
              category,
              current_amount: spending.current,
              previous_amount: spending.previous,
              increase_amount: increase,
              increase_percentage: percentIncrease,
            },
            recommendations: [
              {
                action: `Set a monthly ${category} budget of $${(spending.previous * 1.1).toFixed(2)}`,
                impact: `Could prevent overspending by $${(increase * 0.7).toFixed(2)}/month`,
                difficulty: 'easy' as const,
                estimated_savings: increase * 0.7,
              },
            ],
            confidence_score: 0.85,
          },
          is_actionable: true,
          action_url: `/goals/create?category=${category}&type=budget`,
        });

        insights.push(insight);
      }
    }

    // Save generated insights
    if (insights.length > 0) {
      return await this.insightRepository.saveWithHousehold(householdId, insights);
    }
    return [];
  }

  async generateBudgetRecommendations(householdId: string): Promise<Insight> {
    // Get financial data for analysis
    const [accounts, transactions, goals, loans] = await Promise.all([
      this.accountRepository.findWithHousehold(householdId, {}),
      this.transactionRepository.findWithHousehold(householdId, {
        where: {
          date: MoreThan(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)), // Last 90 days
        },
        relations: ['category'],
      }),
      this.goalRepository.findWithHousehold(householdId, {}),
      this.loanRepository.findWithHousehold(householdId, {}),
    ]);

    // Calculate current income and expenses
    const totalIncome = transactions
      .filter(t => Number(t.amount) > 0)
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const totalExpenses = transactions
      .filter(t => Number(t.amount) < 0)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    const monthlyIncome = totalIncome / 3; // Last 3 months average
    const monthlyExpenses = totalExpenses / 3;

    // Calculate debt payments
    const monthlyDebtPayments = loans.reduce((sum, loan) => {
      return sum + loan.monthly_payment_equivalent;
    }, 0);

    // Generate 50-30-20 budget recommendation
    const recommendedNeedsPercent = 50;
    const recommendedWantsPercent = 30;
    const recommendedSavingsPercent = 20;

    const recommendedNeeds = monthlyIncome * (recommendedNeedsPercent / 100);
    const recommendedWants = monthlyIncome * (recommendedWantsPercent / 100);
    const recommendedSavings = monthlyIncome * (recommendedSavingsPercent / 100);

    const currentSavings = monthlyIncome - monthlyExpenses;
    const savingsGap = recommendedSavings - currentSavings;

    const insight = this.insightRepository.create({
      type: InsightType.BUDGET_RECOMMENDATION,
      title: 'Personalized Budget Recommendations Available',
      description: `Based on your spending patterns, we recommend adjusting your budget to save an additional $${savingsGap.toFixed(2)} per month.`,
      priority: savingsGap > 500 ? InsightPriority.HIGH : InsightPriority.MEDIUM,
      household_id: householdId,
      data: {
        analysis: {
          current_monthly_income: monthlyIncome,
          current_monthly_expenses: monthlyExpenses,
          current_monthly_savings: currentSavings,
          savings_rate: (currentSavings / monthlyIncome) * 100,
          debt_to_income_ratio: (monthlyDebtPayments / monthlyIncome) * 100,
        },
        recommendations: [
          {
            action: `Follow the 50-30-20 budget rule`,
            impact: `Increase savings by $${savingsGap.toFixed(2)}/month`,
            difficulty: 'medium' as const,
            estimated_savings: savingsGap,
          },
          {
            action: `Reduce discretionary spending by 15%`,
            impact: `Save $${(monthlyExpenses * 0.15).toFixed(2)}/month`,
            difficulty: 'easy' as const,
            estimated_savings: monthlyExpenses * 0.15,
          },
        ],
        visualization: {
          type: 'pie' as const,
          data: {
            recommended: {
              needs: recommendedNeeds,
              wants: recommendedWants,
              savings: recommendedSavings,
            },
            current: {
              expenses: monthlyExpenses,
              savings: currentSavings,
            },
          },
        },
        confidence_score: 0.75,
      },
      is_actionable: true,
      action_url: '/budget/create',
    });

    return await this.insightRepository.saveWithHousehold(householdId, insight);
  }

  // Cleanup expired insights
  async cleanupExpiredInsights(): Promise<number> {
    // This method needs to work across all households, so we use raw update
    const result = await this.insightRepository
      .createQueryBuilder()
      .update(Insight)
      .set({ status: InsightStatus.EXPIRED })
      .where('expires_at < :now', { now: new Date() })
      .andWhere('status = :activeStatus', { activeStatus: InsightStatus.ACTIVE })
      .execute();

    return result.affected || 0;
  }
}
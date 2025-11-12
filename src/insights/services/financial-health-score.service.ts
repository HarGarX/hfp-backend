import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import {
  FinancialHealthScore,
  HealthScoreCategory,
} from '../entities/financial-health-score.entity';
import {
  GenerateHealthScoreDto,
  HealthScoreDto,
  HealthScoreHistoryDto,
  SpendingPatternDto,
  BudgetRecommendationDto,
} from '../dto';

// Import related entities for analysis
import { Transaction } from '../../expenses/entities/transaction.entity';
import { Account } from '../../accounts/entities/account.entity';
import { Goal } from '../../goals/entities/goal.entity';
import { Loan } from '../../loans/entities/loan.entity';

@Injectable()
export class FinancialHealthScoreService {
  constructor(
    @InjectRepository(FinancialHealthScore)
    private readonly healthScoreRepository: Repository<FinancialHealthScore>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Goal)
    private readonly goalRepository: Repository<Goal>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
  ) {}

  async generateHealthScore(
    householdId: string,
    userId?: string,
    options?: GenerateHealthScoreDto,
  ): Promise<HealthScoreDto> {
    // Check if recent score exists
    if (!options?.force_recalculation) {
      const recentScore = await this.getRecentHealthScore(householdId, userId);
      if (recentScore) {
        return this.mapToDto(recentScore);
      }
    }

    // Calculate new health score
    const healthScore = await this.calculateHealthScore(householdId, userId);
    
    // Save to database
    const savedScore = await this.healthScoreRepository.save(healthScore);

    return this.mapToDto(savedScore);
  }

  private async getRecentHealthScore(
    householdId: string,
    userId?: string,
  ): Promise<FinancialHealthScore | null> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return await this.healthScoreRepository.findOne({
      where: {
        household_id: householdId,
        user_id: userId,
        calculated_at: MoreThan(sevenDaysAgo),
      },
      order: { calculated_at: 'DESC' },
    });
  }

  private async calculateHealthScore(
    householdId: string,
    userId?: string,
  ): Promise<FinancialHealthScore> {
    // Get financial data for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [accounts, transactions, goals, loans] = await Promise.all([
      this.accountRepository.find({ where: { household_id: householdId } }),
      this.transactionRepository.find({
        where: {
          household_id: householdId,
          ...(userId && { user_id: userId }),
          date: MoreThan(sixMonthsAgo),
        },
        relations: ['category'],
      }),
      this.goalRepository.find({ 
        where: { 
          household_id: householdId,
          ...(userId && { user_id: userId }),
        } 
      }),
      this.loanRepository.find({ 
        where: { 
          household_id: householdId,
          ...(userId && { user_id: userId }),
        } 
      }),
    ]);

    // Calculate metrics
    const metrics = await this.calculateMetrics(accounts, transactions, goals, loans);
    const categoryScores = this.calculateCategoryScores(metrics);
    const overallScore = this.calculateOverallScore(categoryScores);
    const benchmarks = this.calculateBenchmarks(metrics, overallScore);

    const healthScore = this.healthScoreRepository.create({
      household_id: householdId,
      user_id: userId,
      overall_score: overallScore,
      category_scores: categoryScores,
      metrics,
      benchmarks,
      model_version: 'health_score_v1.0.0',
      calculated_at: new Date(),
      next_calculation_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    return healthScore;
  }

  private async calculateMetrics(
    accounts: Account[],
    transactions: Transaction[],
    goals: Goal[],
    loans: Loan[],
  ) {
    // Income and expense calculations
    const totalIncome = transactions
      .filter(t => Number(t.amount) > 0)
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const totalExpenses = transactions
      .filter(t => Number(t.amount) < 0)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    const monthlyIncome = totalIncome / 6; // 6 months average
    const monthlyExpenses = totalExpenses / 6;
    const monthlySavings = monthlyIncome - monthlyExpenses;

    // Calculate debt metrics
    const totalDebt = loans.reduce((sum, loan) => sum + Number(loan.current_balance), 0);
    const monthlyDebtPayments = loans.reduce((sum, loan) => {
      return sum + loan.monthly_payment_equivalent;
    }, 0);

    // Goal metrics
    const activeGoalsCount = goals.filter(g => g.status === 'active').length;
    const completedGoalsCount = goals.filter(g => g.status === 'completed').length;
    const totalGoalsCount = goals.length;

    // Account balances
    const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.current_balance), 0);
    const emergencyFundBalance = totalBalance; // Simplified - should be liquid accounts only
    const emergencyFundMonths = monthlyExpenses > 0 ? emergencyFundBalance / monthlyExpenses : 0;

    // Transaction patterns
    const recentTransactions = transactions.slice(0, 30); // Last 30 transactions
    const categorizedTransactions = recentTransactions.filter(t => t.category_id);
    const categorizationAccuracy = categorizedTransactions.length / recentTransactions.length;

    return {
      // Income and expense ratios
      income_stability: this.calculateIncomeStability(transactions),
      expense_ratio: monthlyIncome > 0 ? monthlyExpenses / monthlyIncome : 1,
      savings_rate: monthlyIncome > 0 ? monthlySavings / monthlyIncome : 0,
      
      // Debt metrics
      debt_to_income_ratio: monthlyIncome > 0 ? totalDebt / (monthlyIncome * 12) : 0,
      credit_utilization: 0.3, // Placeholder - would need credit account data
      on_time_payments: 0.95, // Placeholder - would need payment history
      
      // Goals and planning
      active_goals_count: activeGoalsCount,
      goal_completion_rate: totalGoalsCount > 0 ? completedGoalsCount / totalGoalsCount : 0,
      emergency_fund_months: Math.min(emergencyFundMonths, 6), // Cap at 6 months
      
      // Cash flow patterns
      cash_flow_volatility: this.calculateCashFlowVolatility(transactions),
      recurring_income_percentage: 0.8, // Placeholder
      
      // Behavioral metrics
      budget_adherence: 0.85, // Placeholder
      transaction_categorization_accuracy: categorizationAccuracy,
      financial_app_engagement: 0.7, // Placeholder
    };
  }

  private calculateIncomeStability(transactions: Transaction[]): number {
    const incomeTransactions = transactions
      .filter(t => Number(t.amount) > 0)
      .map(t => Number(t.amount));

    if (incomeTransactions.length < 2) return 0.5;

    const mean = incomeTransactions.reduce((sum, amount) => sum + amount, 0) / incomeTransactions.length;
    const variance = incomeTransactions.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / incomeTransactions.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;

    // Lower coefficient of variation = higher stability
    return Math.max(0, 1 - coefficientOfVariation);
  }

  private calculateCashFlowVolatility(transactions: Transaction[]): number {
    // Group transactions by month and calculate monthly net cash flow
    const monthlyFlows: Record<string, number> = {};

    transactions.forEach(transaction => {
      const monthKey = new Date(transaction.date).toISOString().substring(0, 7);
      if (!monthlyFlows[monthKey]) {
        monthlyFlows[monthKey] = 0;
      }
      monthlyFlows[monthKey] += Number(transaction.amount);
    });

    const flows = Object.values(monthlyFlows);
    if (flows.length < 2) return 0.5;

    const mean = flows.reduce((sum, flow) => sum + flow, 0) / flows.length;
    const variance = flows.reduce((sum, flow) => sum + Math.pow(flow - mean, 2), 0) / flows.length;
    const stdDev = Math.sqrt(variance);

    // Normalize volatility score (lower volatility = better score)
    const normalizedVolatility = Math.abs(mean) > 0 ? stdDev / Math.abs(mean) : 1;
    return Math.max(0, 1 - normalizedVolatility);
  }

  private calculateCategoryScores(metrics: any): Record<HealthScoreCategory, any> {
    return {
      [HealthScoreCategory.BUDGETING]: {
        score: Math.round((metrics.budget_adherence * 70 + metrics.transaction_categorization_accuracy * 30)),
        weight: 0.15,
        trends: { trend_direction: 'stable' as const },
        recommendations: metrics.budget_adherence < 0.8 ? ['Create and stick to a monthly budget'] : [],
      },
      [HealthScoreCategory.SAVINGS]: {
        score: Math.round(Math.min(100, Math.max(0, metrics.savings_rate * 200))), // 50% savings rate = 100 score
        weight: 0.20,
        trends: { trend_direction: 'stable' as const },
        recommendations: metrics.savings_rate < 0.2 ? ['Increase your savings rate to 20%'] : [],
      },
      [HealthScoreCategory.DEBT_MANAGEMENT]: {
        score: Math.round(Math.max(0, 100 - metrics.debt_to_income_ratio * 200)), // 50% DTI = 0 score
        weight: 0.20,
        trends: { trend_direction: 'stable' as const },
        recommendations: metrics.debt_to_income_ratio > 0.36 ? ['Focus on paying down high-interest debt'] : [],
      },
      [HealthScoreCategory.GOAL_PROGRESS]: {
        score: Math.round((metrics.goal_completion_rate * 60 + (metrics.active_goals_count > 0 ? 40 : 0))),
        weight: 0.15,
        trends: { trend_direction: 'stable' as const },
        recommendations: metrics.active_goals_count === 0 ? ['Set 1-3 financial goals'] : [],
      },
      [HealthScoreCategory.CASH_FLOW]: {
        score: Math.round(((1 - metrics.expense_ratio) * 50 + metrics.cash_flow_volatility * 50)),
        weight: 0.15,
        trends: { trend_direction: 'stable' as const },
        recommendations: metrics.expense_ratio > 0.8 ? ['Reduce monthly expenses'] : [],
      },
      [HealthScoreCategory.EMERGENCY_FUND]: {
        score: Math.round(Math.min(100, metrics.emergency_fund_months * 33.33)), // 3 months = 100 score
        weight: 0.15,
        trends: { trend_direction: 'stable' as const },
        recommendations: metrics.emergency_fund_months < 3 ? ['Build emergency fund to 3-6 months expenses'] : [],
      },
      [HealthScoreCategory.CREDIT_UTILIZATION]: {
        score: Math.round(Math.max(0, 100 - metrics.credit_utilization * 333)), // 30% utilization = 0 score
        weight: 0.0, // Placeholder weight since we don't have real credit data
        trends: { trend_direction: 'stable' as const },
        recommendations: [],
      },
      [HealthScoreCategory.INVESTMENT_DIVERSITY]: {
        score: 50, // Placeholder
        weight: 0.0, // Not implemented yet
        trends: { trend_direction: 'stable' as const },
        recommendations: [],
      },
    };
  }

  private calculateOverallScore(categoryScores: Record<HealthScoreCategory, any>): number {
    let totalScore = 0;
    let totalWeight = 0;

    Object.values(categoryScores).forEach(category => {
      if (category.weight > 0) {
        totalScore += category.score * category.weight;
        totalWeight += category.weight;
      }
    });

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 50;
  }

  private calculateBenchmarks(metrics: any, overallScore: number) {
    return {
      peer_group: {
        age_range: '25-34', // Placeholder
        income_range: '$50k-$75k', // Placeholder
        household_size: 2, // Placeholder
      },
      percentile_ranking: Math.max(5, Math.min(95, overallScore)), // Simplified
      top_improvement_areas: [
        'Emergency Fund',
        'Debt Management',
        'Savings Rate',
      ].slice(0, 2),
      strengths: [
        'Income Stability',
        'Goal Setting',
      ].slice(0, 2),
    };
  }

  private mapToDto(healthScore: FinancialHealthScore): HealthScoreDto {
    return {
      overall_score: healthScore.overall_score,
      score_grade: healthScore.score_grade,
      improvement_trend: healthScore.improvement_trend,
      top_strength: healthScore.top_strength,
      biggest_opportunity: healthScore.biggest_opportunity,
      category_scores: healthScore.category_scores,
      metrics: healthScore.metrics,
      benchmarks: healthScore.benchmarks,
      calculated_at: healthScore.calculated_at.toISOString(),
      next_calculation_at: healthScore.next_calculation_at?.toISOString(),
    };
  }

  async getHealthScoreHistory(
    householdId: string,
    userId?: string,
  ): Promise<HealthScoreHistoryDto> {
    const scores = await this.healthScoreRepository.find({
      where: {
        household_id: householdId,
        user_id: userId,
      },
      order: { calculated_at: 'DESC' },
      take: 12, // Last 12 scores (roughly 3 months if calculated weekly)
    });

    const history = scores.reverse().map(score => ({
      date: score.calculated_at.toISOString().split('T')[0],
      overall_score: score.overall_score,
      score_grade: score.score_grade,
      trend: score.improvement_trend,
    }));

    // Extract category trends
    const categoryTrends: Record<HealthScoreCategory, Array<{ date: string; score: number }>> = {} as any;
    
    Object.values(HealthScoreCategory).forEach(category => {
      categoryTrends[category] = scores.map(score => ({
        date: score.calculated_at.toISOString().split('T')[0],
        score: score.category_scores[category]?.score || 0,
      }));
    });

    // Generate milestones (simplified)
    const milestones = scores
      .filter((score, index) => {
        if (index === 0) return false;
        const previousScore = scores[index - 1];
        return Math.abs(score.overall_score - previousScore.overall_score) >= 10;
      })
      .map(score => ({
        date: score.calculated_at.toISOString().split('T')[0],
        description: `Health score ${score.improvement_trend === 'improving' ? 'improved' : 'declined'} significantly`,
        impact: score.overall_score,
        type: score.improvement_trend === 'improving' ? 'improvement' as const : 'decline' as const,
      }));

    return {
      history,
      category_trends: categoryTrends,
      milestones,
    };
  }
}
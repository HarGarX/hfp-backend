import {
  IsOptional,
  IsEnum,
  IsNumber,
  IsObject,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HealthScoreCategory } from '../entities/financial-health-score.entity';

export class GenerateHealthScoreDto {
  @ApiPropertyOptional({
    description: 'Force recalculation even if recent score exists',
    default: false,
  })
  @IsOptional()
  force_recalculation?: boolean = false;

  @ApiPropertyOptional({
    description: 'Include detailed breakdown in response',
    default: true,
  })
  @IsOptional()
  include_breakdown?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include peer comparison data',
    default: true,
  })
  @IsOptional()
  include_benchmarks?: boolean = true;
}

export class HealthScoreDto {
  @ApiProperty({ description: 'Overall financial health score (0-100)' })
  overall_score: number;

  @ApiProperty({ description: 'Score grade (Excellent, Good, Fair, Poor, Critical)' })
  score_grade: string;

  @ApiProperty({ description: 'Overall trend direction' })
  improvement_trend: 'improving' | 'declining' | 'stable';

  @ApiProperty({ description: 'Category with highest score' })
  top_strength: HealthScoreCategory | null;

  @ApiProperty({ description: 'Category with lowest score' })
  biggest_opportunity: HealthScoreCategory | null;

  @ApiProperty({ description: 'Category-specific scores and trends' })
  category_scores: Record<HealthScoreCategory, {
    score: number;
    weight: number;
    trends: {
      previous_score?: number;
      change_percentage?: number;
      trend_direction: 'up' | 'down' | 'stable';
    };
    recommendations?: string[];
  }>;

  @ApiProperty({ description: 'Detailed financial metrics' })
  metrics: {
    income_stability: number;
    expense_ratio: number;
    savings_rate: number;
    debt_to_income_ratio: number;
    credit_utilization: number;
    on_time_payments: number;
    active_goals_count: number;
    goal_completion_rate: number;
    emergency_fund_months: number;
    cash_flow_volatility: number;
    recurring_income_percentage: number;
    budget_adherence: number;
    transaction_categorization_accuracy: number;
    financial_app_engagement: number;
  };

  @ApiProperty({ description: 'Peer comparison and benchmarks' })
  benchmarks: {
    peer_group: {
      age_range?: string;
      income_range?: string;
      household_size?: number;
    };
    percentile_ranking: number;
    top_improvement_areas: string[];
    strengths: string[];
  };

  @ApiProperty({ description: 'When this score was calculated' })
  calculated_at: string;

  @ApiProperty({ description: 'When the next score will be calculated' })
  next_calculation_at?: string;
}

export class HealthScoreHistoryDto {
  @ApiProperty({ description: 'Historical health scores' })
  history: Array<{
    date: string;
    overall_score: number;
    score_grade: string;
    trend: 'improving' | 'declining' | 'stable';
  }>;

  @ApiProperty({ description: 'Category trends over time' })
  category_trends: Record<HealthScoreCategory, Array<{
    date: string;
    score: number;
  }>>;

  @ApiProperty({ description: 'Key milestones and improvements' })
  milestones: Array<{
    date: string;
    description: string;
    impact: number;
    type: 'improvement' | 'decline' | 'achievement';
  }>;
}

export class SpendingPatternDto {
  @ApiProperty({ description: 'Analysis period' })
  period: {
    start_date: string;
    end_date: string;
  };

  @ApiProperty({ description: 'Category-wise spending breakdown' })
  category_breakdown: Array<{
    category_name: string;
    amount: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
    change_from_previous: number;
  }>;

  @ApiProperty({ description: 'Spending patterns and anomalies' })
  patterns: {
    average_daily_spend: number;
    highest_spend_day: { date: string; amount: number };
    most_active_category: string;
    unusual_transactions: Array<{
      date: string;
      description: string;
      amount: number;
      category: string;
      anomaly_type: 'large_amount' | 'new_merchant' | 'unusual_time' | 'frequency';
    }>;
  };

  @ApiProperty({ description: 'Seasonal and temporal patterns' })
  temporal_patterns: {
    day_of_week_avg: Record<string, number>;
    monthly_trends: Array<{
      month: string;
      total: number;
      trend: 'up' | 'down' | 'stable';
    }>;
    peak_spending_times: string[];
  };

  @ApiProperty({ description: 'Recommendations based on patterns' })
  recommendations: Array<{
    type: 'budget_adjustment' | 'category_limit' | 'timing_optimization' | 'goal_creation';
    title: string;
    description: string;
    potential_savings: number;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
}

export class BudgetRecommendationDto {
  @ApiProperty({ description: 'Recommended budget breakdown' })
  recommended_budget: Record<string, {
    current_spending: number;
    recommended_amount: number;
    variance: number;
    rationale: string;
  }>;

  @ApiProperty({ description: 'Overall budget strategy' })
  strategy: {
    total_recommended_budget: number;
    savings_target: number;
    debt_payment_allocation: number;
    discretionary_spending: number;
    budget_method: '50-30-20' | '60-30-10' | 'zero-based' | 'envelope' | 'custom';
  };

  @ApiProperty({ description: 'Implementation plan' })
  implementation: {
    quick_wins: string[];
    gradual_adjustments: Array<{
      category: string;
      current_amount: number;
      target_amount: number;
      timeline_weeks: number;
    }>;
    monitoring_metrics: string[];
  };

  @ApiProperty({ description: 'Expected outcomes' })
  projections: {
    monthly_savings_increase: number;
    debt_payoff_acceleration_months: number;
    goal_achievement_speedup: number;
    stress_reduction_score: number;
  };
}
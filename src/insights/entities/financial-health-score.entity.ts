import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { HouseholdScopedEntity } from '../../shared/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum HealthScoreCategory {
  BUDGETING = 'budgeting',
  SAVINGS = 'savings',
  DEBT_MANAGEMENT = 'debt_management',
  GOAL_PROGRESS = 'goal_progress',
  CASH_FLOW = 'cash_flow',
  EMERGENCY_FUND = 'emergency_fund',
  CREDIT_UTILIZATION = 'credit_utilization',
  INVESTMENT_DIVERSITY = 'investment_diversity',
}

@Entity('financial_health_scores')
@Index(['household_id', 'user_id', 'created_at'])
@Index(['household_id', 'overall_score'])
export class FinancialHealthScore extends HouseholdScopedEntity {
  @Column('uuid', { nullable: true })
  user_id?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  // Overall financial health score (0-100)
  @Column({ type: 'int' })
  overall_score: number;

  // Category-specific scores
  @Column('jsonb')
  category_scores: Record<HealthScoreCategory, {
    score: number; // 0-100
    weight: number; // How much this category contributes to overall score
    trends: {
      previous_score?: number;
      change_percentage?: number;
      trend_direction: 'up' | 'down' | 'stable';
    };
    recommendations?: string[];
  }>;

  // Detailed metrics that went into the calculation
  @Column('jsonb')
  metrics: {
    // Income and expense ratios
    income_stability: number;
    expense_ratio: number;
    savings_rate: number;
    
    // Debt metrics
    debt_to_income_ratio: number;
    credit_utilization: number;
    on_time_payments: number;
    
    // Goals and planning
    active_goals_count: number;
    goal_completion_rate: number;
    emergency_fund_months: number;
    
    // Cash flow patterns
    cash_flow_volatility: number;
    recurring_income_percentage: number;
    
    // Behavioral metrics
    budget_adherence: number;
    transaction_categorization_accuracy: number;
    financial_app_engagement: number;
  };

  // Comparative data
  @Column('jsonb')
  benchmarks: {
    peer_group: {
      age_range?: string;
      income_range?: string;
      household_size?: number;
    };
    percentile_ranking: number; // Where user ranks compared to peers
    top_improvement_areas: string[];
    strengths: string[];
  };

  // Model information
  @Column({ type: 'varchar', length: 100 })
  model_version: string;

  @Column({ type: 'timestamp' })
  calculated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  next_calculation_at?: Date;

  // Historical tracking
  @Column('uuid', { nullable: true })
  previous_score_id?: string;

  // Computed properties
  get score_grade(): string {
    if (this.overall_score >= 80) return 'Excellent';
    if (this.overall_score >= 70) return 'Good';
    if (this.overall_score >= 60) return 'Fair';
    if (this.overall_score >= 50) return 'Poor';
    return 'Critical';
  }

  get improvement_trend(): 'improving' | 'declining' | 'stable' {
    // Calculate based on category trends
    const trends = Object.values(this.category_scores).map(cat => cat.trends.trend_direction);
    const improving = trends.filter(t => t === 'up').length;
    const declining = trends.filter(t => t === 'down').length;
    
    if (improving > declining) return 'improving';
    if (declining > improving) return 'declining';
    return 'stable';
  }

  get top_strength(): HealthScoreCategory | null {
    let topCategory: HealthScoreCategory | null = null;
    let topScore = 0;

    for (const [category, data] of Object.entries(this.category_scores)) {
      if (data.score > topScore) {
        topScore = data.score;
        topCategory = category as HealthScoreCategory;
      }
    }

    return topCategory;
  }

  get biggest_opportunity(): HealthScoreCategory | null {
    let worstCategory: HealthScoreCategory | null = null;
    let worstScore = 100;

    for (const [category, data] of Object.entries(this.category_scores)) {
      if (data.score < worstScore) {
        worstScore = data.score;
        worstCategory = category as HealthScoreCategory;
      }
    }

    return worstCategory;
  }

  get weighted_average_score(): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const data of Object.values(this.category_scores)) {
      totalScore += data.score * data.weight;
      totalWeight += data.weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }
}
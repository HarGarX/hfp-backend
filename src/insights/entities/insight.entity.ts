import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { HouseholdScopedEntity } from '../../shared/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum InsightType {
  SPENDING_PATTERN = 'spending_pattern',
  BUDGET_RECOMMENDATION = 'budget_recommendation',
  SAVINGS_OPPORTUNITY = 'savings_opportunity',
  DEBT_ANALYSIS = 'debt_analysis',
  GOAL_PROGRESS = 'goal_progress',
  CASH_FLOW_FORECAST = 'cash_flow_forecast',
  CATEGORY_ANALYSIS = 'category_analysis',
  SEASONAL_TREND = 'seasonal_trend',
  ANOMALY_DETECTION = 'anomaly_detection',
  FINANCIAL_HEALTH = 'financial_health',
}

export enum InsightPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum InsightStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  DISMISSED = 'dismissed',
  EXPIRED = 'expired',
}

@Entity('insights')
@Index(['household_id', 'type', 'status'])
@Index(['household_id', 'created_at'])
@Index(['household_id', 'priority', 'status'])
export class Insight extends HouseholdScopedEntity {
  @Column({
    type: 'enum',
    enum: InsightType,
  })
  type: InsightType;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: InsightPriority,
    default: InsightPriority.MEDIUM,
  })
  priority: InsightPriority;

  @Column({
    type: 'enum',
    enum: InsightStatus,
    default: InsightStatus.ACTIVE,
  })
  status: InsightStatus;

  @Column('uuid', { nullable: true })
  user_id?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  // Insight content and recommendations
  @Column('jsonb')
  data: {
    // Analytical data that generated this insight
    analysis?: Record<string, any>;
    // Specific recommendations for the user
    recommendations?: Array<{
      action: string;
      impact: string;
      difficulty: 'easy' | 'medium' | 'hard';
      estimated_savings?: number;
    }>;
    // Visual data for charts/graphs
    visualization?: {
      type: 'line' | 'bar' | 'pie' | 'trend';
      data: any;
      config?: Record<string, any>;
    };
    // Related entities (accounts, categories, goals, loans)
    related_entities?: {
      accounts?: string[];
      categories?: string[];
      goals?: string[];
      loans?: string[];
    };
    // Confidence score for ML-generated insights
    confidence_score?: number;
    // Timeframe this insight covers
    period?: {
      start_date: string;
      end_date: string;
    };
  };

  // ML Model information
  @Column({ type: 'varchar', length: 100, nullable: true })
  model_version?: string;

  @Column({ type: 'timestamp', nullable: true })
  acknowledged_at?: Date;

  @Column('uuid', { nullable: true })
  acknowledged_by?: string;

  @Column({ type: 'timestamp', nullable: true })
  expires_at?: Date;

  // Engagement tracking
  @Column({ type: 'int', default: 0 })
  view_count: number;

  @Column({ type: 'timestamp', nullable: true })
  last_viewed_at?: Date;

  @Column({ type: 'boolean', default: false })
  is_actionable: boolean;

  @Column({ type: 'text', nullable: true })
  action_url?: string;

  // Feedback for ML improvement
  @Column({ type: 'int', nullable: true })
  user_rating?: number; // 1-5 stars

  @Column({ type: 'text', nullable: true })
  user_feedback?: string;

  // Computed properties
  get is_expired(): boolean {
    if (!this.expires_at) return false;
    return new Date() > new Date(this.expires_at);
  }

  get days_since_created(): number {
    const now = new Date();
    const created = new Date(this.created_at);
    const diffTime = now.getTime() - created.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  get engagement_score(): number {
    // Simple engagement scoring based on views, acknowledgment, and rating
    let score = 0;
    
    // Base score from views
    score += Math.min(this.view_count * 10, 50);
    
    // Acknowledgment bonus
    if (this.acknowledged_at) score += 25;
    
    // Rating bonus
    if (this.user_rating) score += this.user_rating * 10;
    
    // Time decay (older insights lose engagement value)
    const daysPenalty = Math.max(0, this.days_since_created - 7) * 2;
    score -= daysPenalty;
    
    return Math.max(0, Math.min(100, score));
  }

  get confidence_level(): string {
    const confidence = this.data.confidence_score || 0;
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  }

  get estimated_impact(): number {
    // Calculate potential financial impact from recommendations
    if (!this.data.recommendations) return 0;
    
    return this.data.recommendations.reduce((total, rec) => {
      return total + (rec.estimated_savings || 0);
    }, 0);
  }
}
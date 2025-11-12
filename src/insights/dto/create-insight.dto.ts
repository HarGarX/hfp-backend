import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsNumber,
  IsObject,
  IsArray,
  IsBoolean,
  IsDateString,
  Min,
  Max,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InsightType,
  InsightPriority,
  InsightStatus,
} from '../entities/insight.entity';

export class CreateInsightDto {
  @ApiProperty({
    description: 'Type of insight',
    enum: InsightType,
    example: InsightType.SPENDING_PATTERN,
  })
  @IsEnum(InsightType)
  type: InsightType;

  @ApiProperty({
    description: 'Insight title',
    example: 'High Dining Out Spending Detected',
    maxLength: 200,
  })
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiProperty({
    description: 'Detailed description of the insight',
    example: 'Your dining out expenses have increased 40% compared to last month',
  })
  @IsString()
  description: string;

  @ApiPropertyOptional({
    description: 'Priority level of the insight',
    enum: InsightPriority,
    default: InsightPriority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(InsightPriority)
  priority?: InsightPriority = InsightPriority.MEDIUM;

  @ApiPropertyOptional({
    description: 'Specific user this insight is for (optional for household-wide insights)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @ApiProperty({
    description: 'Insight data including analysis, recommendations, and visualizations',
    example: {
      analysis: { category: 'dining_out', amount_increase: 250.50 },
      recommendations: [
        {
          action: 'Set a monthly dining budget of $400',
          impact: 'Could save $150/month',
          difficulty: 'easy',
          estimated_savings: 150,
        },
      ],
    },
  })
  @IsObject()
  data: {
    analysis?: Record<string, any>;
    recommendations?: Array<{
      action: string;
      impact: string;
      difficulty: 'easy' | 'medium' | 'hard';
      estimated_savings?: number;
    }>;
    visualization?: {
      type: 'line' | 'bar' | 'pie' | 'trend';
      data: any;
      config?: Record<string, any>;
    };
    related_entities?: {
      accounts?: string[];
      categories?: string[];
      goals?: string[];
      loans?: string[];
    };
    confidence_score?: number;
    period?: {
      start_date: string;
      end_date: string;
    };
  };

  @ApiPropertyOptional({
    description: 'ML model version that generated this insight',
    example: 'spending_analyzer_v2.1.0',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  model_version?: string;

  @ApiPropertyOptional({
    description: 'When this insight expires',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  expires_at?: string;

  @ApiPropertyOptional({
    description: 'Whether this insight provides actionable recommendations',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_actionable?: boolean = false;

  @ApiPropertyOptional({
    description: 'URL for taking action on this insight',
    example: '/goals/create?category=dining_out&amount=400',
  })
  @IsOptional()
  @IsString()
  action_url?: string;
}

export class UpdateInsightDto {
  @ApiPropertyOptional({
    description: 'Insight status',
    enum: InsightStatus,
  })
  @IsOptional()
  @IsEnum(InsightStatus)
  status?: InsightStatus;

  @ApiPropertyOptional({
    description: 'User rating for this insight (1-5 stars)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  user_rating?: number;

  @ApiPropertyOptional({
    description: 'User feedback about this insight',
  })
  @IsOptional()
  @IsString()
  user_feedback?: string;
}

export class InsightFiltersDto {
  @ApiPropertyOptional({
    description: 'Filter by insight type',
    enum: InsightType,
  })
  @IsOptional()
  @IsEnum(InsightType)
  type?: InsightType;

  @ApiPropertyOptional({
    description: 'Filter by priority level',
    enum: InsightPriority,
  })
  @IsOptional()
  @IsEnum(InsightPriority)
  priority?: InsightPriority;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: InsightStatus,
  })
  @IsOptional()
  @IsEnum(InsightStatus)
  status?: InsightStatus;

  @ApiPropertyOptional({
    description: 'Filter by specific user',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @ApiPropertyOptional({
    description: 'Filter insights created after this date',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  created_after?: string;

  @ApiPropertyOptional({
    description: 'Filter insights created before this date',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  created_before?: string;

  @ApiPropertyOptional({
    description: 'Only show actionable insights',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  actionable_only?: boolean = false;

  @ApiPropertyOptional({
    description: 'Minimum confidence score (0-1)',
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  min_confidence?: number;
}

export class InsightSummaryDto {
  @ApiProperty({ description: 'Total number of insights' })
  total_insights: number;

  @ApiProperty({ description: 'Active insights count' })
  active_insights: number;

  @ApiProperty({ description: 'Critical priority insights count' })
  critical_insights: number;

  @ApiProperty({ description: 'Actionable insights count' })
  actionable_insights: number;

  @ApiProperty({ description: 'Average user rating across all rated insights' })
  average_rating: number;

  @ApiProperty({ description: 'Total potential savings from all recommendations' })
  total_potential_savings: number;

  @ApiProperty({ description: 'Most common insight types' })
  top_insight_types: Array<{
    type: InsightType;
    count: number;
    percentage: number;
  }>;

  @ApiProperty({ description: 'Engagement metrics' })
  engagement_metrics: {
    average_views_per_insight: number;
    acknowledgment_rate: number;
    dismissal_rate: number;
    average_time_to_acknowledgment_hours: number;
  };

  @ApiProperty({ description: 'Recent trend in insight generation' })
  generation_trend: {
    this_week: number;
    last_week: number;
    change_percentage: number;
  };
}

export class AcknowledgeInsightDto {
  @ApiPropertyOptional({
    description: 'Optional note about why the insight was acknowledged',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
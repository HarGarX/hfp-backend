import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Check,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { HouseholdScopedEntity } from '../../shared/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Account } from '../../accounts/entities/account.entity';
import { Category } from '../../expenses/entities/category.entity';

export enum GoalType {
  SAVINGS = 'savings',
  DEBT_PAYOFF = 'debt_payoff',
  EMERGENCY_FUND = 'emergency_fund',
  INVESTMENT = 'investment',
  PURCHASE = 'purchase',
  VACATION = 'vacation',
  CUSTOM = 'custom',
}

export enum GoalStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  OVERDUE = 'overdue',
}

export enum GoalPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum RecurrenceType {
  NONE = 'none',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

@Entity('goals')
@Index(['household_id', 'status'])
@Index(['household_id', 'target_date'])
@Index(['household_id', 'goal_type'])
@Index(['household_id', 'created_by'])
@Check('target_amount > 0')
@Check('current_amount >= 0')
@Check('target_date > created_at')
export class Goal extends HouseholdScopedEntity {
  @ApiProperty({
    description: 'Goal name',
    example: 'Emergency Fund',
    maxLength: 255,
  })
  @Column({ length: 255 })
  name: string;

  @ApiProperty({
    description: 'Detailed description of the goal',
    example: 'Build an emergency fund covering 6 months of expenses',
    required: false,
  })
  @Column('text', { nullable: true })
  description?: string;

  @ApiProperty({
    description: 'Type of goal',
    enum: GoalType,
    example: GoalType.EMERGENCY_FUND,
  })
  @Column({
    type: 'enum',
    enum: GoalType,
    default: GoalType.CUSTOM,
  })
  goal_type: GoalType;

  @ApiProperty({
    description: 'Current status of the goal',
    enum: GoalStatus,
    example: GoalStatus.ACTIVE,
  })
  @Column({
    type: 'enum',
    enum: GoalStatus,
    default: GoalStatus.ACTIVE,
  })
  status: GoalStatus;

  @ApiProperty({
    description: 'Goal priority level',
    enum: GoalPriority,
    example: GoalPriority.HIGH,
  })
  @Column({
    type: 'enum',
    enum: GoalPriority,
    default: GoalPriority.MEDIUM,
  })
  priority: GoalPriority;

  @ApiProperty({
    description: 'Target amount to achieve',
    example: 25000.00,
    minimum: 0.01,
  })
  @Column('decimal', { precision: 12, scale: 2 })
  target_amount: number;

  @ApiProperty({
    description: 'Current progress amount',
    example: 12500.00,
    minimum: 0,
  })
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  current_amount: number;

  @ApiProperty({
    description: 'Target completion date',
    example: '2025-12-31T23:59:59.000Z',
  })
  @Column('timestamp')
  target_date: Date;

  @ApiProperty({
    description: 'Date when goal was completed',
    example: '2025-11-15T10:30:00.000Z',
    required: false,
  })
  @Column('timestamp', { nullable: true })
  completed_at?: Date;

  @ApiProperty({
    description: 'Automatic contribution setup',
    enum: RecurrenceType,
    example: RecurrenceType.MONTHLY,
  })
  @Column({
    type: 'enum',
    enum: RecurrenceType,
    default: RecurrenceType.NONE,
  })
  auto_contribute: RecurrenceType;

  @ApiProperty({
    description: 'Automatic contribution amount',
    example: 500.00,
    minimum: 0,
    required: false,
  })
  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  auto_contribute_amount?: number;

  @ApiProperty({
    description: 'Next automatic contribution date',
    example: '2025-12-01T00:00:00.000Z',
    required: false,
  })
  @Column('timestamp', { nullable: true })
  next_contribution_date?: Date;

  @ApiProperty({
    description: 'Associated account for automatic contributions',
    example: 'uuid-string',
    required: false,
  })
  @Column('uuid', { nullable: true })
  account_id?: string;

  @ApiProperty({
    description: 'Associated category for expense tracking',
    example: 'uuid-string',
    required: false,
  })
  @Column('uuid', { nullable: true })
  category_id?: string;

  @ApiProperty({
    description: 'User who created the goal',
    example: 'uuid-string',
  })
  @Column('uuid')
  created_by: string;

  @ApiProperty({
    description: 'Additional metadata for the goal',
    example: { icon: 'piggy-bank', color: '#4CAF50' },
    required: false,
  })
  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Tags for goal categorization',
    example: ['vacation', 'family'],
    required: false,
  })
  @Column('simple-array', { nullable: true })
  tags?: string[];

  @ApiProperty({
    description: 'Motivational notes or reminders',
    example: 'Remember: This is for the family vacation to Europe!',
    required: false,
  })
  @Column('text', { nullable: true })
  notes?: string;

  // Relations
  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @ManyToOne(() => Account, { eager: false, nullable: true })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  @ManyToOne(() => Category, { eager: false, nullable: true })
  @JoinColumn({ name: 'category_id' })
  category?: Category;

  // Computed properties
  get progress_percentage(): number {
    return this.target_amount > 0 
      ? Math.min(100, (this.current_amount / this.target_amount) * 100)
      : 0;
  }

  get remaining_amount(): number {
    return Math.max(0, this.target_amount - this.current_amount);
  }

  get days_remaining(): number {
    const now = new Date();
    const target = new Date(this.target_date);
    const diffTime = target.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  get is_overdue(): boolean {
    return new Date() > new Date(this.target_date) && this.status === GoalStatus.ACTIVE;
  }

  get required_monthly_contribution(): number {
    const monthsRemaining = this.days_remaining / 30;
    return monthsRemaining > 0 ? this.remaining_amount / monthsRemaining : 0;
  }
}
import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  Check,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { HouseholdScopedEntity } from '../../shared/entities/base.entity';
import { Goal } from './goal.entity';
import { User } from '../../users/entities/user.entity';
import { Transaction } from '../../expenses/entities/transaction.entity';

export enum GoalActivityType {
  MANUAL_CONTRIBUTION = 'manual_contribution',
  AUTO_CONTRIBUTION = 'auto_contribution',
  WITHDRAWAL = 'withdrawal',
  MILESTONE_REACHED = 'milestone_reached',
  TARGET_UPDATED = 'target_updated',
  STATUS_CHANGED = 'status_changed',
  NOTE_ADDED = 'note_added',
  GOAL_CREATED = 'goal_created',
  GOAL_COMPLETED = 'goal_completed',
  GOAL_CANCELLED = 'goal_cancelled',
}

@Entity('goal_activities')
@Index(['household_id', 'goal_id'])
@Index(['household_id', 'activity_type'])
@Index(['household_id', 'performed_by'])
@Index(['created_at'])
@Check('amount >= 0 OR amount IS NULL')
export class GoalActivity extends HouseholdScopedEntity {
  @ApiProperty({
    description: 'Associated goal ID',
    example: 'uuid-string',
  })
  @Column('uuid')
  goal_id: string;

  @ApiProperty({
    description: 'Type of activity performed',
    enum: GoalActivityType,
    example: GoalActivityType.MANUAL_CONTRIBUTION,
  })
  @Column({
    type: 'enum',
    enum: GoalActivityType,
  })
  activity_type: GoalActivityType;

  @ApiProperty({
    description: 'Amount involved in the activity',
    example: 250.00,
    minimum: 0,
    required: false,
  })
  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  amount?: number;

  @ApiProperty({
    description: 'Previous value before the activity',
    example: 1000.00,
    required: false,
  })
  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  previous_value?: number;

  @ApiProperty({
    description: 'New value after the activity',
    example: 1250.00,
    required: false,
  })
  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  new_value?: number;

  @ApiProperty({
    description: 'Description or notes about the activity',
    example: 'Monthly automatic contribution',
    required: false,
  })
  @Column('text', { nullable: true })
  description?: string;

  @ApiProperty({
    description: 'User who performed the activity',
    example: 'uuid-string',
  })
  @Column('uuid')
  performed_by: string;

  @ApiProperty({
    description: 'Associated transaction ID if applicable',
    example: 'uuid-string',
    required: false,
  })
  @Column('uuid', { nullable: true })
  transaction_id?: string;

  @ApiProperty({
    description: 'Additional metadata for the activity',
    example: { source: 'mobile_app', automated: true },
    required: false,
  })
  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;

  // Relations
  @ManyToOne(() => Goal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'goal_id' })
  goal: Goal;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'performed_by' })
  performer: User;

  @ManyToOne(() => Transaction, { eager: false, nullable: true })
  @JoinColumn({ name: 'transaction_id' })
  transaction?: Transaction;
}
import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { HouseholdScopedEntity } from '../../shared/entities/base.entity';

export enum NotificationType {
  EXPENSE_ALERT = 'expense_alert',
  GOAL_MILESTONE = 'goal_milestone',
  LOAN_PAYMENT_DUE = 'loan_payment_due',
  BUDGET_EXCEEDED = 'budget_exceeded',
  SAVINGS_OPPORTUNITY = 'savings_opportunity',
  ACCOUNT_SYNC_FAILED = 'account_sync_failed',
  INSIGHT_GENERATED = 'insight_generated',
  FINANCIAL_HEALTH_UPDATE = 'financial_health_update',
  WEEKLY_DIGEST = 'weekly_digest',
  MONTHLY_REPORT = 'monthly_report',
  CUSTOM_ALERT = 'custom_alert',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('notifications')
@Index(['household_id', 'user_id', 'status'])
@Index(['household_id', 'type', 'status'])
@Index(['household_id', 'created_at'])
@Index(['scheduled_at'])
export class Notification extends HouseholdScopedEntity {

  // Notification content
  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({ length: 200 })
  title: string;

  @Column('text')
  message: string;

  @Column({
    type: 'enum',
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM,
  })
  priority: NotificationPriority;

  // Targeting
  @Column('uuid', { nullable: true })
  user_id?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  // Delivery settings
  @Column({
    type: 'enum',
    enum: NotificationChannel,
    array: true,
  })
  channels: NotificationChannel[];

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  // Scheduling
  @Column({ type: 'timestamp', nullable: true })
  scheduled_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  sent_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  delivered_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  read_at?: Date;

  // Metadata
  @Column('jsonb', { nullable: true })
  metadata?: {
    entity_type?: string;
    entity_id?: string;
    template_id?: string;
    custom_data?: Record<string, any>;
  };

  // Tracking
  @Column({ type: 'text', nullable: true })
  action_url?: string;

  @Column({ default: 0 })
  retry_count: number;

  @Column({ type: 'timestamp', nullable: true })
  retry_after?: Date;

  @Column({ type: 'text', nullable: true })
  error_message?: string;

  // User interaction
  @Column({ type: 'timestamp', nullable: true })
  clicked_at?: Date;

  @Column({ type: 'text', nullable: true })
  clicked_url?: string;

  // Computed properties
  get is_overdue(): boolean {
    return !!(
      this.scheduled_at &&
      this.scheduled_at < new Date() &&
      this.status === NotificationStatus.PENDING
    );
  }

  get is_interactive(): boolean {
    return !!this.action_url;
  }

  get delivery_attempts(): number {
    return this.retry_count + 1;
  }

  get time_to_delivery(): number | null {
    if (!this.sent_at || !this.delivered_at) return null;
    return this.delivered_at.getTime() - this.sent_at.getTime();
  }

  get time_to_read(): number | null {
    if (!this.delivered_at || !this.read_at) return null;
    return this.read_at.getTime() - this.delivered_at.getTime();
  }
}
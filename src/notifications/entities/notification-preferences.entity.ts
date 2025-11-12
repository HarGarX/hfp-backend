import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { HouseholdScopedEntity } from '../../shared/entities/base.entity';
import {
  NotificationType,
  NotificationChannel,
  NotificationPriority,
} from './notification.entity';

export enum DigestFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  NEVER = 'never',
}

export enum QuietHoursMode {
  DISABLED = 'disabled',
  ENABLED = 'enabled',
  WEEKDAYS_ONLY = 'weekdays_only',
  WEEKENDS_ONLY = 'weekends_only',
}

@Entity('notification_preferences')
@Unique(['household_id', 'user_id'])
@Index(['household_id', 'user_id'])
export class NotificationPreferences extends HouseholdScopedEntity {
  // User association
  @Column('uuid')
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Global settings
  @Column({ default: true })
  enabled: boolean;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
    array: true,
    default: ['in_app'],
  })
  enabled_channels: NotificationChannel[];

  // Type-specific settings
  @Column('jsonb', {
    default: {},
  })
  type_settings: Record<
    NotificationType,
    {
      enabled?: boolean;
      channels?: NotificationChannel[];
      minimum_priority?: NotificationPriority;
      delay_minutes?: number;
    }
  >;

  // Digest preferences
  @Column({
    type: 'enum',
    enum: DigestFrequency,
    default: DigestFrequency.WEEKLY,
  })
  digest_frequency: DigestFrequency;

  @Column({ type: 'time', nullable: true, default: '09:00' })
  digest_time?: string;

  @Column({ type: 'int', array: true, nullable: true })
  digest_days?: number[]; // 0-6 for Sunday-Saturday

  // Quiet hours
  @Column({
    type: 'enum',
    enum: QuietHoursMode,
    default: QuietHoursMode.ENABLED,
  })
  quiet_hours_mode: QuietHoursMode;

  @Column({ type: 'time', nullable: true, default: '22:00' })
  quiet_hours_start?: string;

  @Column({ type: 'time', nullable: true, default: '08:00' })
  quiet_hours_end?: string;

  // Priority thresholds
  @Column({
    type: 'enum',
    enum: NotificationPriority,
    default: NotificationPriority.LOW,
  })
  minimum_priority: NotificationPriority;

  @Column({
    type: 'enum',
    enum: NotificationPriority,
    default: NotificationPriority.HIGH,
  })
  urgent_override_threshold: NotificationPriority;

  // Rate limiting
  @Column({ default: 10 })
  max_notifications_per_hour: number;

  @Column({ default: 50 })
  max_notifications_per_day: number;

  // Channel-specific settings
  @Column('jsonb', {
    default: {},
  })
  channel_settings: {
    email?: {
      address?: string;
      verified?: boolean;
      bounce_count?: number;
    };
    sms?: {
      phone_number?: string;
      verified?: boolean;
      opt_out?: boolean;
    };
    push?: {
      device_tokens?: string[];
      enabled?: boolean;
    };
  };

  // Computed properties
  get is_in_quiet_hours(): boolean {
    if (this.quiet_hours_mode === QuietHoursMode.DISABLED) {
      return false;
    }

    const now = new Date();
    const currentDay = now.getDay(); // 0-6 for Sunday-Saturday
    const currentTime = now.toTimeString().slice(0, 5); // HH:mm format

    // Check if quiet hours apply to current day
    if (this.quiet_hours_mode === QuietHoursMode.WEEKDAYS_ONLY && (currentDay === 0 || currentDay === 6)) {
      return false;
    }
    if (this.quiet_hours_mode === QuietHoursMode.WEEKENDS_ONLY && currentDay !== 0 && currentDay !== 6) {
      return false;
    }

    // Check time range
    if (!this.quiet_hours_start || !this.quiet_hours_end) {
      return false;
    }

    const startTime = this.quiet_hours_start;
    const endTime = this.quiet_hours_end;

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    }

    return currentTime >= startTime && currentTime <= endTime;
  }

  get should_send_digest_today(): boolean {
    if (this.digest_frequency === DigestFrequency.NEVER) {
      return false;
    }

    const today = new Date().getDay();

    switch (this.digest_frequency) {
      case DigestFrequency.DAILY:
        return true;
      case DigestFrequency.WEEKLY:
        return this.digest_days?.includes(today) ?? today === 1; // Default to Monday
      case DigestFrequency.MONTHLY:
        return new Date().getDate() === 1; // First of month
      default:
        return false;
    }
  }

  get effective_channels(): NotificationChannel[] {
    if (!this.enabled) {
      return [];
    }
    return this.enabled_channels;
  }

  // Helper methods
  canReceiveNotification(
    type: NotificationType,
    priority: NotificationPriority,
    channel: NotificationChannel,
  ): boolean {
    if (!this.enabled) {
      return false;
    }

    // Check if channel is enabled
    if (!this.enabled_channels.includes(channel)) {
      return false;
    }

    // Check type-specific settings
    const typeSettings = this.type_settings[type];
    if (typeSettings?.enabled === false) {
      return false;
    }

    if (typeSettings?.channels && !typeSettings.channels.includes(channel)) {
      return false;
    }

    // Check priority thresholds
    const priorityOrder = [
      NotificationPriority.LOW,
      NotificationPriority.MEDIUM,
      NotificationPriority.HIGH,
      NotificationPriority.URGENT,
    ];

    const minPriority = typeSettings?.minimum_priority || this.minimum_priority;
    const minIndex = priorityOrder.indexOf(minPriority);
    const currentIndex = priorityOrder.indexOf(priority);

    if (currentIndex < minIndex) {
      return false;
    }

    // Check if urgent override applies
    if (priority === NotificationPriority.URGENT) {
      return priorityOrder.indexOf(priority) >= priorityOrder.indexOf(this.urgent_override_threshold);
    }

    // Check quiet hours (unless urgent)
    if (priority as string !== NotificationPriority.URGENT && this.is_in_quiet_hours) {
      return false;
    }

    return true;
  }

  getDelayMinutes(type: NotificationType): number {
    return this.type_settings[type]?.delay_minutes || 0;
  }
}
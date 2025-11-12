import {
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
  IsString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  NotificationType,
  NotificationPriority,
  NotificationChannel,
} from '../entities/notification.entity';
import {
  DigestFrequency,
  QuietHoursMode,
} from '../entities/notification-preferences.entity';

export class CreateNotificationPreferencesDto {
  @ApiPropertyOptional({
    description: 'Whether notifications are enabled globally',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;

  @ApiPropertyOptional({
    enum: NotificationChannel,
    isArray: true,
    description: 'Enabled notification channels',
    default: ['in_app'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  enabled_channels?: NotificationChannel[] = [NotificationChannel.IN_APP];

  @ApiPropertyOptional({
    description: 'Type-specific notification settings',
  })
  @IsOptional()
  @IsObject()
  type_settings?: Record<
    NotificationType,
    {
      enabled?: boolean;
      channels?: NotificationChannel[];
      minimum_priority?: NotificationPriority;
      delay_minutes?: number;
    }
  >;

  @ApiPropertyOptional({
    enum: DigestFrequency,
    description: 'How often to send digest notifications',
    default: DigestFrequency.WEEKLY,
  })
  @IsOptional()
  @IsEnum(DigestFrequency)
  digest_frequency?: DigestFrequency = DigestFrequency.WEEKLY;

  @ApiPropertyOptional({
    description: 'Time of day to send digests (HH:mm format)',
    pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$',
  })
  @IsOptional()
  @IsString()
  digest_time?: string;

  @ApiPropertyOptional({
    description: 'Days of week for digest (0-6 for Sunday-Saturday)',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  digest_days?: number[];

  @ApiPropertyOptional({
    enum: QuietHoursMode,
    description: 'Quiet hours configuration',
    default: QuietHoursMode.ENABLED,
  })
  @IsOptional()
  @IsEnum(QuietHoursMode)
  quiet_hours_mode?: QuietHoursMode = QuietHoursMode.ENABLED;

  @ApiPropertyOptional({
    description: 'Quiet hours start time (HH:mm format)',
    pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$',
  })
  @IsOptional()
  @IsString()
  quiet_hours_start?: string;

  @ApiPropertyOptional({
    description: 'Quiet hours end time (HH:mm format)',
    pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$',
  })
  @IsOptional()
  @IsString()
  quiet_hours_end?: string;

  @ApiPropertyOptional({
    enum: NotificationPriority,
    description: 'Minimum priority for notifications to be sent',
    default: NotificationPriority.LOW,
  })
  @IsOptional()
  @IsEnum(NotificationPriority)
  minimum_priority?: NotificationPriority = NotificationPriority.LOW;

  @ApiPropertyOptional({
    enum: NotificationPriority,
    description: 'Priority threshold that overrides quiet hours',
    default: NotificationPriority.HIGH,
  })
  @IsOptional()
  @IsEnum(NotificationPriority)
  urgent_override_threshold?: NotificationPriority = NotificationPriority.HIGH;

  @ApiPropertyOptional({
    description: 'Maximum notifications per hour',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  max_notifications_per_hour?: number = 10;

  @ApiPropertyOptional({
    description: 'Maximum notifications per day',
    minimum: 1,
    maximum: 500,
    default: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  max_notifications_per_day?: number = 50;

  @ApiPropertyOptional({
    description: 'Channel-specific settings',
  })
  @IsOptional()
  @IsObject()
  channel_settings?: {
    email?: {
      address?: string;
      verified?: boolean;
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
}

export class UpdateNotificationPreferencesDto extends CreateNotificationPreferencesDto {
  // Inherits all fields as optional from CreateNotificationPreferencesDto
}

export class QuickPreferencesDto {
  @ApiPropertyOptional({
    description: 'Quick enable/disable all notifications',
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Quick enable/disable email notifications',
  })
  @IsOptional()
  @IsBoolean()
  email_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Quick enable/disable SMS notifications',
  })
  @IsOptional()
  @IsBoolean()
  sms_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Quick enable/disable push notifications',
  })
  @IsOptional()
  @IsBoolean()
  push_enabled?: boolean;

  @ApiPropertyOptional({
    enum: DigestFrequency,
    description: 'Quick change digest frequency',
  })
  @IsOptional()
  @IsEnum(DigestFrequency)
  digest_frequency?: DigestFrequency;
}
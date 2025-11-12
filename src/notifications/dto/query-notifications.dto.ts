import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  IsBoolean,
  IsString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  NotificationStatus,
} from '../entities/notification.entity';

export class QueryNotificationsDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: NotificationType,
    description: 'Filter by notification type',
  })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({
    enum: NotificationStatus,
    description: 'Filter by notification status',
  })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @ApiPropertyOptional({
    enum: NotificationPriority,
    description: 'Filter by minimum priority level',
  })
  @IsOptional()
  @IsEnum(NotificationPriority)
  min_priority?: NotificationPriority;

  @ApiPropertyOptional({
    enum: NotificationChannel,
    description: 'Filter by delivery channel',
  })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({
    description: 'Filter by target user ID',
  })
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by notifications created after this date',
  })
  @IsOptional()
  @IsDateString()
  created_after?: string;

  @ApiPropertyOptional({
    description: 'Filter by notifications created before this date',
  })
  @IsOptional()
  @IsDateString()
  created_before?: string;

  @ApiPropertyOptional({
    description: 'Filter by read status',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  is_read?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by interactive notifications only',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  is_interactive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by overdue status',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  is_overdue?: boolean;

  @ApiPropertyOptional({
    description: 'Search in notification title and message',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['created_at', 'updated_at', 'priority', 'scheduled_at', 'sent_at'],
    default: 'created_at',
  })
  @IsOptional()
  @IsString()
  sort_by?: string = 'created_at';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @IsString()
  sort_order?: 'ASC' | 'DESC' = 'DESC';
}

export class NotificationStatsDto {
  @ApiPropertyOptional({
    description: 'Start date for statistics',
  })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional({
    description: 'End date for statistics',
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({
    description: 'Group statistics by period',
    enum: ['hour', 'day', 'week', 'month'],
    default: 'day',
  })
  @IsOptional()
  @IsString()
  group_by?: 'hour' | 'day' | 'week' | 'month' = 'day';

  @ApiPropertyOptional({
    enum: NotificationType,
    description: 'Filter statistics by notification type',
  })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({
    enum: NotificationChannel,
    description: 'Filter statistics by channel',
  })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;
}

export class CreateFromTemplateDto {
  @ApiPropertyOptional({
    description: 'Template ID to use',
  })
  @IsOptional()
  @IsUUID()
  template_id?: string;

  @ApiPropertyOptional({
    description: 'Template name to use (alternative to template_id)',
  })
  @IsOptional()
  @IsString()
  template_name?: string;

  @ApiPropertyOptional({
    description: 'Variables to populate the template',
  })
  @IsOptional()
  variables?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Target user ID (if null, sends to all household members)',
  })
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @ApiPropertyOptional({
    description: 'Override template channels',
    enum: NotificationChannel,
    isArray: true,
  })
  @IsOptional()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];

  @ApiPropertyOptional({
    description: 'Override template priority',
    enum: NotificationPriority,
  })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({
    description: 'When to send the notification',
  })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  scheduled_at?: Date;
}
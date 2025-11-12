import {
  IsEnum,
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  IsBoolean,
  IsDateString,
  IsObject,
  IsUrl,
  Length,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NotificationType,
  NotificationPriority,
  NotificationChannel,
} from '../entities/notification.entity';

export class CreateNotificationDto {
  @ApiProperty({
    enum: NotificationType,
    description: 'Type of notification',
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({
    description: 'Notification title',
    maxLength: 200,
  })
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiProperty({
    description: 'Notification message content',
  })
  @IsString()
  @Length(1, 2000)
  message: string;

  @ApiPropertyOptional({
    enum: NotificationPriority,
    description: 'Notification priority',
    default: NotificationPriority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority = NotificationPriority.MEDIUM;

  @ApiPropertyOptional({
    description: 'Target user ID (if null, sends to all household members)',
  })
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @ApiProperty({
    enum: NotificationChannel,
    isArray: true,
    description: 'Delivery channels for the notification',
  })
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels: NotificationChannel[];

  @ApiPropertyOptional({
    description: 'When to send the notification (if not provided, sends immediately)',
  })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  scheduled_at?: Date;

  @ApiPropertyOptional({
    description: 'Additional metadata for the notification',
  })
  @IsOptional()
  @IsObject()
  metadata?: {
    entity_type?: string;
    entity_id?: string;
    template_id?: string;
    custom_data?: Record<string, any>;
  };

  @ApiPropertyOptional({
    description: 'Action URL for interactive notifications',
  })
  @IsOptional()
  @IsUrl()
  action_url?: string;
}

export class BulkCreateNotificationDto {
  @ApiProperty({
    type: [CreateNotificationDto],
    description: 'Array of notifications to create',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateNotificationDto)
  notifications: CreateNotificationDto[];

  @ApiPropertyOptional({
    description: 'Whether to continue processing if some notifications fail',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  continue_on_error?: boolean = false;
}
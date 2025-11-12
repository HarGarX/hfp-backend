import { PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsDateString,
  IsString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateNotificationDto } from './create-notification.dto';
import { NotificationStatus } from '../entities/notification.entity';

export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {
  @ApiPropertyOptional({
    enum: NotificationStatus,
    description: 'Notification status',
  })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @ApiPropertyOptional({
    description: 'When the notification was sent',
  })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  sent_at?: Date;

  @ApiPropertyOptional({
    description: 'When the notification was delivered',
  })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  delivered_at?: Date;

  @ApiPropertyOptional({
    description: 'When the notification was read',
  })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  read_at?: Date;

  @ApiPropertyOptional({
    description: 'Error message if delivery failed',
  })
  @IsOptional()
  @IsString()
  error_message?: string;

  @ApiPropertyOptional({
    description: 'Number of retry attempts',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  retry_count?: number;
}

export class MarkNotificationReadDto {
  @ApiPropertyOptional({
    description: 'URL that was clicked (for tracking)',
  })
  @IsOptional()
  @IsString()
  clicked_url?: string;
}

export class BulkUpdateNotificationsDto {
  @ApiPropertyOptional({
    enum: NotificationStatus,
    description: 'Status to set for all matching notifications',
  })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @ApiPropertyOptional({
    description: 'Mark all as read',
  })
  @IsOptional()
  mark_as_read?: boolean;
}
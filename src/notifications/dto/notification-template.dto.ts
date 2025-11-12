import {
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  IsObject,
  IsNumber,
  Length,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NotificationType,
  NotificationChannel,
  NotificationPriority,
} from '../entities/notification.entity';
import { TemplateStatus } from '../entities/notification-template.entity';

export class CreateNotificationTemplateDto {
  @ApiProperty({
    description: 'Template name',
    maxLength: 100,
  })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional({
    description: 'Template description',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @ApiProperty({
    enum: NotificationType,
    description: 'Type of notification this template is for',
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({
    enum: NotificationChannel,
    description: 'Delivery channel this template is for',
  })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({
    description: 'Subject line template',
    maxLength: 200,
  })
  @IsString()
  @Length(1, 200)
  subject_template: string;

  @ApiProperty({
    description: 'Body text template',
  })
  @IsString()
  @Length(1, 5000)
  body_template: string;

  @ApiPropertyOptional({
    description: 'HTML version of body template (for email)',
  })
  @IsOptional()
  @IsString()
  html_template?: string;

  @ApiPropertyOptional({
    enum: NotificationPriority,
    description: 'Default priority for notifications using this template',
    default: NotificationPriority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(NotificationPriority)
  default_priority?: NotificationPriority = NotificationPriority.MEDIUM;

  @ApiPropertyOptional({
    description: 'Template variable definitions',
  })
  @IsOptional()
  @IsObject()
  template_variables?: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'date' | 'currency';
    description?: string;
    required?: boolean;
    default_value?: any;
    format?: string;
  }>;

  @ApiPropertyOptional({
    description: 'Styling configuration for the template',
  })
  @IsOptional()
  @IsObject()
  styling?: {
    email?: {
      theme?: string;
      primary_color?: string;
      secondary_color?: string;
      font_family?: string;
      header_image?: string;
    };
    sms?: {
      max_length?: number;
      include_links?: boolean;
    };
    push?: {
      icon?: string;
      badge?: number;
      sound?: string;
    };
    in_app?: {
      show_avatar?: boolean;
      highlight_color?: string;
      icon?: string;
    };
  };

  @ApiPropertyOptional({
    description: 'Locale for this template',
    default: 'en',
  })
  @IsOptional()
  @IsString()
  @Length(2, 10)
  locale?: string = 'en';

  @ApiPropertyOptional({
    description: 'Translations for other locales',
  })
  @IsOptional()
  @IsObject()
  translations?: Record<string, {
    subject_template: string;
    body_template: string;
    html_template?: string;
  }>;

  @ApiPropertyOptional({
    description: 'Template version',
    default: '1.0.0',
  })
  @IsOptional()
  @IsString()
  version?: string = '1.0.0';

  @ApiPropertyOptional({
    description: 'Whether this template can be customized',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  is_customizable?: boolean = true;
}

export class UpdateNotificationTemplateDto {
  @ApiPropertyOptional({
    description: 'Template name',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Template description',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @ApiPropertyOptional({
    enum: TemplateStatus,
    description: 'Template status',
  })
  @IsOptional()
  @IsEnum(TemplateStatus)
  status?: TemplateStatus;

  @ApiPropertyOptional({
    description: 'Subject line template',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  subject_template?: string;

  @ApiPropertyOptional({
    description: 'Body text template',
  })
  @IsOptional()
  @IsString()
  @Length(1, 5000)
  body_template?: string;

  @ApiPropertyOptional({
    description: 'HTML version of body template (for email)',
  })
  @IsOptional()
  @IsString()
  html_template?: string;

  @ApiPropertyOptional({
    enum: NotificationPriority,
    description: 'Default priority for notifications using this template',
  })
  @IsOptional()
  @IsEnum(NotificationPriority)
  default_priority?: NotificationPriority;

  @ApiPropertyOptional({
    description: 'Template variable definitions',
  })
  @IsOptional()
  @IsObject()
  template_variables?: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'date' | 'currency';
    description?: string;
    required?: boolean;
    default_value?: any;
    format?: string;
  }>;

  @ApiPropertyOptional({
    description: 'Styling configuration for the template',
  })
  @IsOptional()
  @IsObject()
  styling?: any;

  @ApiPropertyOptional({
    description: 'Translations for other locales',
  })
  @IsOptional()
  @IsObject()
  translations?: Record<string, {
    subject_template: string;
    body_template: string;
    html_template?: string;
  }>;

  @ApiPropertyOptional({
    description: 'Template version',
  })
  @IsOptional()
  @IsString()
  version?: string;
}

export class RenderTemplateDto {
  @ApiProperty({
    description: 'Template variables to use for rendering',
  })
  @IsObject()
  variables: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Locale for rendering (if template has translations)',
  })
  @IsOptional()
  @IsString()
  locale?: string;
}

export class TestTemplateDto extends RenderTemplateDto {
  @ApiPropertyOptional({
    description: 'Test email address to send to (if testing email template)',
  })
  @IsOptional()
  @IsString()
  test_email?: string;

  @ApiPropertyOptional({
    description: 'Test phone number to send to (if testing SMS template)',
  })
  @IsOptional()
  @IsString()
  test_phone?: string;
}
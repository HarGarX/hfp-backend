import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  IsUUID,
  IsArray,
  IsPositive,
  MinLength,
  MaxLength,
  Min,
  Max,
  ValidateIf,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { GoalType, GoalStatus, GoalPriority, RecurrenceType } from '../entities/goal.entity';

export class CreateGoalDto {
  @ApiProperty({
    description: 'Goal name',
    example: 'Emergency Fund',
    minLength: 1,
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the goal',
    example: 'Build an emergency fund covering 6 months of expenses',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    description: 'Type of goal',
    enum: GoalType,
    example: GoalType.EMERGENCY_FUND,
  })
  @IsEnum(GoalType)
  goal_type: GoalType;

  @ApiPropertyOptional({
    description: 'Goal priority level',
    enum: GoalPriority,
    example: GoalPriority.HIGH,
    default: GoalPriority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(GoalPriority)
  priority?: GoalPriority = GoalPriority.MEDIUM;

  @ApiProperty({
    description: 'Target amount to achieve',
    example: 25000.00,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  target_amount: number;

  @ApiPropertyOptional({
    description: 'Initial amount already saved towards this goal',
    example: 2500.00,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  current_amount?: number = 0;

  @ApiProperty({
    description: 'Target completion date (ISO 8601 format)',
    example: '2025-12-31T23:59:59.000Z',
  })
  @IsDateString()
  target_date: string;

  @ApiPropertyOptional({
    description: 'Automatic contribution setup',
    enum: RecurrenceType,
    example: RecurrenceType.MONTHLY,
    default: RecurrenceType.NONE,
  })
  @IsOptional()
  @IsEnum(RecurrenceType)
  auto_contribute?: RecurrenceType = RecurrenceType.NONE;

  @ApiPropertyOptional({
    description: 'Automatic contribution amount (required if auto_contribute is not NONE)',
    example: 500.00,
    minimum: 0.01,
  })
  @ValidateIf((o) => o.auto_contribute && o.auto_contribute !== RecurrenceType.NONE)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  auto_contribute_amount?: number;

  @ApiPropertyOptional({
    description: 'Associated account ID for automatic contributions',
    example: 'uuid-string',
  })
  @IsOptional()
  @IsUUID()
  account_id?: string;

  @ApiPropertyOptional({
    description: 'Associated category ID for expense tracking',
    example: 'uuid-string',
  })
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Tags for goal categorization',
    example: ['vacation', 'family'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => Array.isArray(value) ? value : [])
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Motivational notes or reminders',
    example: 'Remember: This is for the family vacation to Europe!',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the goal',
    example: { icon: 'piggy-bank', color: '#4CAF50' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
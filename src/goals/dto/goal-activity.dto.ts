import {
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsPositive,
  MaxLength,
  IsObject,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { GoalActivityType } from '../entities/goal-activity.entity';

export class CreateGoalActivityDto {
  @ApiProperty({
    description: 'Associated goal ID',
    example: 'uuid-string',
  })
  @IsNotEmpty()
  @IsUUID()
  goal_id: string;

  @ApiProperty({
    description: 'Type of activity performed',
    enum: GoalActivityType,
    example: GoalActivityType.MANUAL_CONTRIBUTION,
  })
  @IsEnum(GoalActivityType)
  activity_type: GoalActivityType;

  @ApiPropertyOptional({
    description: 'Amount involved in the activity',
    example: 250.00,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Previous value before the activity',
    example: 1000.00,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  previous_value?: number;

  @ApiPropertyOptional({
    description: 'New value after the activity',
    example: 1250.00,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  new_value?: number;

  @ApiPropertyOptional({
    description: 'Description or notes about the activity',
    example: 'Monthly automatic contribution',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Associated transaction ID if applicable',
    example: 'uuid-string',
  })
  @IsOptional()
  @IsUUID()
  transaction_id?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the activity',
    example: { source: 'mobile_app', automated: true },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class GoalContributionDto {
  @ApiProperty({
    description: 'Contribution amount',
    example: 500.00,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({
    description: 'Description for the contribution',
    example: 'Bonus contribution from salary increase',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Associated transaction ID if this contribution comes from a transaction',
    example: 'uuid-string',
  })
  @IsOptional()
  @IsUUID()
  transaction_id?: string;
}

export class GoalWithdrawalDto {
  @ApiProperty({
    description: 'Withdrawal amount',
    example: 200.00,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @ApiProperty({
    description: 'Reason for the withdrawal',
    example: 'Emergency expense - car repair',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({
    description: 'Associated transaction ID if this withdrawal creates a transaction',
    example: 'uuid-string',
  })
  @IsOptional()
  @IsUUID()
  transaction_id?: string;
}
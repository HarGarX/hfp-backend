import { IsString, IsEnum, IsOptional, IsObject, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SimulationType } from '../entities/simulation.entity';

export class ScenarioDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty()
  @IsObject()
  @IsNotEmpty()
  parameters: Record<string, any>;
}

export class CreateSimulationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: SimulationType })
  @IsEnum(SimulationType)
  simulation_type: SimulationType;

  @ApiProperty()
  @IsObject()
  @IsNotEmpty()
  base_scenario: Record<string, any>;

  @ApiPropertyOptional({ type: [ScenarioDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScenarioDto)
  @IsOptional()
  scenarios?: ScenarioDto[];
}

export class UpdateSimulationDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  base_scenario?: Record<string, any>;

  @ApiPropertyOptional({ type: [ScenarioDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScenarioDto)
  @IsOptional()
  scenarios?: ScenarioDto[];
}

export class RunSimulationDto {
  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  scenario_names?: string[];
}

export class AddScenarioDto extends ScenarioDto {}

// Specific simulation type DTOs

export class GoalSimulationDto {
  @ApiProperty()
  @IsString()
  goal_id: string;

  @ApiProperty()
  @IsNotEmpty()
  target_amount: number;

  @ApiProperty()
  @IsNotEmpty()
  monthly_contribution: number;

  @ApiPropertyOptional()
  @IsOptional()
  current_amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  expected_return_rate?: number; // Annual percentage

  @ApiPropertyOptional()
  @IsOptional()
  target_date?: string;
}

export class DebtPayoffSimulationDto {
  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  loan_ids: string[];

  @ApiPropertyOptional()
  @IsOptional()
  extra_payment_amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  payoff_strategy?: 'snowball' | 'avalanche' | 'custom';
}

export class BudgetSimulationDto {
  @ApiProperty()
  @IsObject()
  category_adjustments: Record<string, number>; // category_id -> new amount

  @ApiPropertyOptional()
  @IsOptional()
  income_change?: number;

  @ApiPropertyOptional()
  @IsOptional()
  timeframe_months?: number;
}

export class RetirementSimulationDto {
  @ApiProperty()
  @IsNotEmpty()
  current_age: number;

  @ApiProperty()
  @IsNotEmpty()
  retirement_age: number;

  @ApiProperty()
  @IsNotEmpty()
  current_savings: number;

  @ApiProperty()
  @IsNotEmpty()
  monthly_contribution: number;

  @ApiPropertyOptional()
  @IsOptional()
  expected_return_rate?: number; // Annual percentage

  @ApiPropertyOptional()
  @IsOptional()
  expected_inflation_rate?: number; // Annual percentage

  @ApiPropertyOptional()
  @IsOptional()
  desired_retirement_income?: number; // Monthly
}

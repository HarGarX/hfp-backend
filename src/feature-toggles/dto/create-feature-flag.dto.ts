import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  IsObject,
  MaxLength,
} from 'class-validator';

export class CreateFeatureFlagDto {
  @ApiProperty({
    description: 'Unique key for the feature flag (e.g., "insights.ai_recommendations")',
    example: 'insights.ai_recommendations',
  })
  @IsString()
  @MaxLength(255)
  key: string;

  @ApiProperty({
    description: 'Human-readable name for the feature',
    example: 'AI-Powered Recommendations',
  })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Detailed description of the feature',
    example: 'Enable AI-powered financial recommendations in the insights module',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Whether the feature is globally enabled',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiProperty({
    description: 'Rollout percentage (0-100) for gradual feature release',
    example: 50,
    minimum: 0,
    maximum: 100,
    default: 0,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  rolloutPercentage?: number;

  @ApiProperty({
    description: 'Array of household IDs to target',
    example: ['0fb3a24b-cd4e-46f7-ad64-8adb4c4bbf41'],
    type: [String],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetHouseholds?: string[];

  @ApiProperty({
    description: 'Array of roles to target (e.g., ["household_admin"])',
    example: ['household_admin'],
    type: [String],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetRoles?: string[];

  @ApiProperty({
    description: 'Complex targeting conditions (JSON object)',
    example: { minAccountBalance: 1000, hasLinkedBankAccount: true },
    required: false,
  })
  @IsObject()
  @IsOptional()
  conditions?: Record<string, any>;

  @ApiProperty({
    description: 'Additional metadata for the feature flag',
    example: { owner: 'product-team', jiraTicket: 'HFP-123' },
    required: false,
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

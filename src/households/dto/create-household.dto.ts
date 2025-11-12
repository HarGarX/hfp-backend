import { IsString, IsOptional, IsEnum, IsEmail, IsPhoneNumber, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HouseholdStatus } from '../entities/household.entity';

export class CreateHouseholdDto {
  @ApiProperty({
    description: 'Household name',
    example: 'The Smith Family',
    minLength: 2,
    maxLength: 255
  })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: 'Optional description of the household',
    example: 'A family of four with two children',
    maxLength: 1000
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Initial status of the household',
    enum: HouseholdStatus,
    default: HouseholdStatus.ACTIVE
  })
  @IsOptional()
  @IsEnum(HouseholdStatus)
  status?: HouseholdStatus;

  @ApiPropertyOptional({
    description: 'Default currency for the household',
    example: 'USD',
    maxLength: 3
  })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  default_currency?: string;

  @ApiPropertyOptional({
    description: 'Household timezone',
    example: 'America/New_York',
    maxLength: 50
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Household address',
    example: '123 Main St, Anytown, ST 12345',
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({
    description: 'Household phone number',
    example: '+1-555-123-4567',
    maxLength: 20
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Household email address',
    example: 'family@example.com',
    format: 'email'
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Additional household preferences and settings',
    example: { notifications: true, budgetAlerts: true }
  })
  @IsOptional()
  preferences?: Record<string, any>;
}
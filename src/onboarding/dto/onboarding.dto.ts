import { IsString, IsOptional, IsEmail, ValidateNested, IsEnum, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateHouseholdDto {
  @ApiProperty({ description: 'Household name', example: 'The Smith Family' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Household address', example: '123 Main St' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'City', example: 'New York' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'State', example: 'NY' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'ZIP code', example: '10001' })
  @IsOptional()
  @IsString()
  zip_code?: string;

  @ApiProperty({ description: 'Country code', example: 'US' })
  @IsString()
  country: string;

  @ApiProperty({ description: 'Default currency', example: 'USD' })
  @IsString()
  default_currency: string;
}

export class CreateUserDto {
  @ApiProperty({ description: 'Email address', example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  first_name: string;

  @ApiProperty({ description: 'Last name', example: 'Smith' })
  @IsString()
  last_name: string;

  @ApiPropertyOptional({ description: 'Username', example: 'johnsmith' })
  @IsOptional()
  @IsString()
  username?: string;
}

export class OnboardingStartDto {
  @ApiProperty({ type: CreateHouseholdDto })
  @ValidateNested()
  @Type(() => CreateHouseholdDto)
  household: CreateHouseholdDto;

  @ApiProperty({ type: CreateUserDto })
  @ValidateNested()
  @Type(() => CreateUserDto)
  user: CreateUserDto;
}

export class OnboardingMemberDto {
  @ApiProperty({ description: 'Email address', example: 'jane@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'First name', example: 'Jane' })
  @IsString()
  first_name: string;

  @ApiProperty({ description: 'Last name', example: 'Smith' })
  @IsString()
  last_name: string;

  @ApiProperty({ 
    description: 'User role',
    enum: ['HOUSEHOLD_ADMIN', 'HOUSEHOLD_MEMBER', 'HOUSEHOLD_VIEWER'],
    example: 'HOUSEHOLD_MEMBER'
  })
  @IsEnum(['HOUSEHOLD_ADMIN', 'HOUSEHOLD_MEMBER', 'HOUSEHOLD_VIEWER'])
  role: 'HOUSEHOLD_ADMIN' | 'HOUSEHOLD_MEMBER' | 'HOUSEHOLD_VIEWER';
}

export class RoleAssignmentDto {
  @ApiProperty({ description: 'User ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  userId: string;

  @ApiProperty({ 
    description: 'Role to assign',
    enum: ['HOUSEHOLD_ADMIN', 'HOUSEHOLD_MEMBER', 'HOUSEHOLD_VIEWER'],
    example: 'HOUSEHOLD_ADMIN'
  })
  @IsEnum(['HOUSEHOLD_ADMIN', 'HOUSEHOLD_MEMBER', 'HOUSEHOLD_VIEWER'])
  role: 'HOUSEHOLD_ADMIN' | 'HOUSEHOLD_MEMBER' | 'HOUSEHOLD_VIEWER';
}

export class OnboardingRolesDto {
  @ApiProperty({ type: [RoleAssignmentDto] })
  @ValidateNested({ each: true })
  @Type(() => RoleAssignmentDto)
  assignments: RoleAssignmentDto[];
}

export class OnboardingStatusDto {
  @ApiProperty({ description: 'Current onboarding step' })
  @IsString()
  step: string;

  @ApiProperty({ description: 'Whether the step is completed' })
  completed: boolean;

  @ApiPropertyOptional({ description: 'Additional step data' })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}
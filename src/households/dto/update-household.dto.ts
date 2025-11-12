import { IsString, IsOptional, IsEnum, IsEmail, MaxLength, MinLength } from 'class-validator';
import { HouseholdStatus } from '../entities/household.entity';

export class UpdateHouseholdDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(HouseholdStatus)
  status?: HouseholdStatus;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  default_currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  preferences?: Record<string, any>;
}
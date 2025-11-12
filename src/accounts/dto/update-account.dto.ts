import { 
  IsString, 
  IsEnum, 
  IsOptional, 
  IsNumber, 
  IsDateString, 
  IsBoolean,
  MaxLength, 
  MinLength,
  Min,
  Max
} from 'class-validator';
import { AccountStatus } from '../entities/account.entity';

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-999999999999999.99)
  @Max(999999999999999.99)
  current_balance?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-999999999999999.99)
  @Max(999999999999999.99)
  available_balance?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  bank_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  account_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  routing_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  iban?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  credit_limit?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  interest_rate?: number;

  @IsOptional()
  @IsDateString()
  opening_date?: string;

  @IsOptional()
  @IsDateString()
  closing_date?: string;

  @IsOptional()
  @IsBoolean()
  is_external?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  external_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  external_provider?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
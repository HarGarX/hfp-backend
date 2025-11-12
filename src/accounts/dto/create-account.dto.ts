import { 
  IsString, 
  IsEnum, 
  IsOptional, 
  IsNumber, 
  IsDateString, 
  IsBoolean,
  IsDecimal,
  MaxLength, 
  MinLength,
  Min,
  Max
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType, AccountStatus } from '../entities/account.entity';

export class CreateAccountDto {
  @ApiProperty({
    description: 'Account name',
    example: 'Main Checking Account',
    minLength: 2,
    maxLength: 255
  })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: 'Optional account description',
    example: 'Primary checking account for daily expenses',
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Type of financial account',
    enum: AccountType,
    example: AccountType.CHECKING
  })
  @IsEnum(AccountType)
  account_type: AccountType;

  @ApiPropertyOptional({
    description: 'Initial account status',
    enum: AccountStatus,
    default: AccountStatus.ACTIVE
  })
  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;

  @ApiPropertyOptional({
    description: 'Current account balance',
    example: 1500.00,
    minimum: -999999999999999.99,
    maximum: 999999999999999.99
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-999999999999999.99)
  @Max(999999999999999.99)
  current_balance?: number;

  @ApiPropertyOptional({
    description: 'Available account balance (for credit accounts)',
    example: 1500.00,
    minimum: -999999999999999.99,
    maximum: 999999999999999.99
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-999999999999999.99)
  @Max(999999999999999.99)
  available_balance?: number;

  @ApiPropertyOptional({
    description: 'Account currency code',
    example: 'USD',
    maxLength: 3
  })
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
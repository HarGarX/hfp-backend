import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsDateString,
  IsBoolean,
  IsArray,
  IsUUID,
  IsDate,
  MaxLength,
  MinLength,
  Min,
  Max,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType, TransactionStatus } from '../entities/transaction.entity';

export class CreateTransactionDto {
  @ApiProperty({
    description: 'Transaction amount (positive for income/expenses, negative for refunds)',
    example: 25.99,
    minimum: -999999999999999.99,
    maximum: 999999999999999.99
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-999999999999999.99)
  @Max(999999999999999.99)
  amount: number;

  @ApiProperty({
    description: 'Type of transaction',
    enum: TransactionType,
    example: TransactionType.EXPENSE
  })
  @IsEnum(TransactionType)
  transaction_type: TransactionType;

  @ApiProperty({
    description: 'Brief description of the transaction',
    example: 'Grocery shopping at Whole Foods',
    minLength: 1,
    maxLength: 255
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  description: string;

  @ApiProperty({
    description: 'Transaction date',
    example: '2023-11-11',
    type: 'string',
    format: 'date'
  })
  @IsDateString()
  date: string;

  @ApiProperty({
    description: 'Account ID where the transaction occurs',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid'
  })
  @IsUUID()
  account_id: string;

  @ApiPropertyOptional({
    description: 'Transaction status',
    enum: TransactionStatus,
    default: TransactionStatus.COMPLETED
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional({
    description: 'Additional notes about the transaction',
    example: 'Weekly grocery shopping for family',
    maxLength: 1000
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Currency code',
    example: 'USD',
    default: 'USD',
    maxLength: 3
  })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({
    description: 'Merchant or vendor name',
    example: 'Whole Foods Market',
    maxLength: 255
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  merchant?: string;

  @ApiPropertyOptional({
    description: 'Reference number from bank or receipt',
    example: 'REF123456789',
    maxLength: 100
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference_number?: string;

  @ApiPropertyOptional({
    description: 'External ID for bank import reconciliation',
    example: 'BANK_TXN_001',
    maxLength: 100
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  external_id?: string;

  @ApiPropertyOptional({
    description: 'Category ID for expense categorization',
    example: '123e4567-e89b-12d3-a456-426614174001',
    format: 'uuid'
  })
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Target account ID for transfers',
    example: '123e4567-e89b-12d3-a456-426614174002',
    format: 'uuid'
  })
  @IsOptional()
  @IsUUID()
  transfer_account_id?: string;

  @ApiPropertyOptional({
    description: 'Whether this is a recurring transaction',
    default: false
  })
  @IsOptional()
  @IsBoolean()
  is_recurring?: boolean;

  @ApiPropertyOptional({
    description: 'Frequency of recurring transaction',
    example: 'monthly',
    enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually']
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  recurring_frequency?: string;

  @ApiPropertyOptional({
    description: 'End date for recurring transactions',
    type: 'string',
    format: 'date'
  })
  @IsOptional()
  @IsDateString()
  recurring_end_date?: string;

  @ApiPropertyOptional({
    description: 'Array of tags for categorization',
    example: ['food', 'groceries', 'family'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Additional metadata as key-value pairs',
    example: { receipt_image_url: 'https://example.com/receipt.jpg', loyalty_points_earned: 25 }
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
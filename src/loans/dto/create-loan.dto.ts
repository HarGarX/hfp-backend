import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsNumber,
  IsDateString,
  IsInt,
  Min,
  Max,
  Length,
  IsObject,
  IsPositive,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  LoanType,
  LoanStatus,
  PaymentFrequency,
} from '../entities/loan.entity';

export class CreateLoanDto {
  @ApiProperty({
    description: 'Name of the loan',
    example: 'Home Mortgage',
    maxLength: 200,
  })
  @IsString()
  @Length(1, 200)
  name: string;

  @ApiPropertyOptional({
    description: 'Description of the loan',
    example: 'Primary residence mortgage from Bank of America',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Type of loan',
    enum: LoanType,
    example: LoanType.MORTGAGE,
  })
  @IsEnum(LoanType)
  type: LoanType;

  @ApiPropertyOptional({
    description: 'Current status of the loan',
    enum: LoanStatus,
    default: LoanStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus = LoanStatus.ACTIVE;

  @ApiPropertyOptional({
    description: 'Account ID associated with this loan',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  account_id?: string;

  @ApiProperty({
    description: 'Principal loan amount',
    example: 250000.00,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Transform(({ value }) => parseFloat(value))
  principal_amount: number;

  @ApiPropertyOptional({
    description: 'Current outstanding balance',
    example: 235000.00,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  current_balance?: number;

  @ApiPropertyOptional({
    description: 'Annual interest rate (as decimal, e.g., 0.0575 for 5.75%)',
    example: 0.0575,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  @Transform(({ value }) => parseFloat(value))
  interest_rate?: number = 0;

  @ApiPropertyOptional({
    description: 'Payment frequency',
    enum: PaymentFrequency,
    default: PaymentFrequency.MONTHLY,
  })
  @IsOptional()
  @IsEnum(PaymentFrequency)
  payment_frequency?: PaymentFrequency = PaymentFrequency.MONTHLY;

  @ApiPropertyOptional({
    description: 'Regular payment amount',
    example: 1200.00,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  payment_amount?: number;

  @ApiProperty({
    description: 'Loan start date',
    example: '2023-01-15',
    format: 'date',
  })
  @IsDateString()
  start_date: string;

  @ApiPropertyOptional({
    description: 'Loan maturity date',
    example: '2053-01-15',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  maturity_date?: string;

  @ApiPropertyOptional({
    description: 'Next payment due date',
    example: '2024-02-15',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  next_payment_date?: string;

  // BNPL specific fields
  @ApiPropertyOptional({
    description: 'BNPL provider name (for BNPL loans)',
    example: 'Klarna',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  bnpl_provider?: string;

  @ApiPropertyOptional({
    description: 'Merchant name (for BNPL loans)',
    example: 'Amazon',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  merchant?: string;

  @ApiPropertyOptional({
    description: 'Total number of installments (for BNPL loans)',
    example: 4,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  installment_count?: number;

  @ApiPropertyOptional({
    description: 'Late fee amount',
    example: 25.00,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  late_fee_amount?: number = 0;

  @ApiPropertyOptional({
    description: 'Additional metadata for the loan',
    example: { originalLender: 'Bank A', servicer: 'Company B' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateLoanDto {
  @ApiPropertyOptional({
    description: 'Name of the loan',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @ApiPropertyOptional({
    description: 'Description of the loan',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Current status of the loan',
    enum: LoanStatus,
  })
  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;

  @ApiPropertyOptional({
    description: 'Current outstanding balance',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  current_balance?: number;

  @ApiPropertyOptional({
    description: 'Annual interest rate (as decimal)',
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  @Transform(({ value }) => parseFloat(value))
  interest_rate?: number;

  @ApiPropertyOptional({
    description: 'Payment frequency',
    enum: PaymentFrequency,
  })
  @IsOptional()
  @IsEnum(PaymentFrequency)
  payment_frequency?: PaymentFrequency;

  @ApiPropertyOptional({
    description: 'Regular payment amount',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  payment_amount?: number;

  @ApiPropertyOptional({
    description: 'Loan maturity date',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  maturity_date?: string;

  @ApiPropertyOptional({
    description: 'Next payment due date',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  next_payment_date?: string;

  @ApiPropertyOptional({
    description: 'Last payment date',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  last_payment_date?: string;

  @ApiPropertyOptional({
    description: 'BNPL provider name',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  bnpl_provider?: string;

  @ApiPropertyOptional({
    description: 'Merchant name',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  merchant?: string;

  @ApiPropertyOptional({
    description: 'Total number of installments',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  installment_count?: number;

  @ApiPropertyOptional({
    description: 'Late fee amount',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  late_fee_amount?: number;

  @ApiPropertyOptional({
    description: 'Additional metadata for the loan',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class LoanSummaryDto {
  @ApiProperty({ description: 'Total number of active loans' })
  total_loans: number;

  @ApiProperty({ description: 'Total outstanding debt across all loans' })
  total_debt: number;

  @ApiProperty({ description: 'Total monthly payment obligations' })
  monthly_payment_total: number;

  @ApiProperty({ description: 'Total interest paid to date' })
  total_interest_paid: number;

  @ApiProperty({ description: 'Total fees paid to date' })
  total_fees_paid: number;

  @ApiProperty({ description: 'Number of loans that are overdue' })
  overdue_loans_count: number;

  @ApiProperty({ description: 'Average interest rate across all loans' })
  average_interest_rate: number;

  @ApiProperty({ description: 'Breakdown by loan type' })
  breakdown_by_type: Record<string, {
    count: number;
    total_balance: number;
    monthly_payment: number;
  }>;

  @ApiProperty({ description: 'Next payment due date across all loans' })
  next_payment_date?: string;

  @ApiProperty({ description: 'Total amount due in next payments' })
  next_payment_amount: number;
}

export class PayoffProjectionDto {
  @ApiProperty({ description: 'Loan ID' })
  loan_id: string;

  @ApiProperty({ description: 'Current balance' })
  current_balance: number;

  @ApiProperty({ description: 'Estimated payoff date with current payments' })
  estimated_payoff_date?: string;

  @ApiProperty({ description: 'Total interest if paid as scheduled' })
  total_interest_remaining: number;

  @ApiProperty({ description: 'Total amount to be paid' })
  total_amount_remaining: number;

  @ApiProperty({ description: 'Number of payments remaining' })
  payments_remaining: number;

  @ApiProperty({ description: 'Monthly payment amount' })
  monthly_payment: number;
}
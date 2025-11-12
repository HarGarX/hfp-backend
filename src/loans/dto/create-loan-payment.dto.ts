import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsNumber,
  IsDateString,
  Min,
  Length,
  IsObject,
  IsPositive,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PaymentType,
  PaymentStatus,
  PaymentMethod,
} from '../entities/loan-payment.entity';

export class CreateLoanPaymentDto {
  @ApiProperty({
    description: 'ID of the loan this payment is for',
    format: 'uuid',
  })
  @IsUUID()
  loan_id: string;

  @ApiProperty({
    description: 'Total payment amount',
    example: 1200.00,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Transform(({ value }) => parseFloat(value))
  amount: number;

  @ApiPropertyOptional({
    description: 'Portion of payment applied to principal',
    example: 800.00,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  principal_amount?: number = 0;

  @ApiPropertyOptional({
    description: 'Portion of payment applied to interest',
    example: 400.00,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  interest_amount?: number = 0;

  @ApiPropertyOptional({
    description: 'Portion of payment applied to fees',
    example: 0.00,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  fee_amount?: number = 0;

  @ApiPropertyOptional({
    description: 'Type of payment',
    enum: PaymentType,
    default: PaymentType.REGULAR,
  })
  @IsOptional()
  @IsEnum(PaymentType)
  type?: PaymentType = PaymentType.REGULAR;

  @ApiPropertyOptional({
    description: 'Payment status',
    enum: PaymentStatus,
    default: PaymentStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus = PaymentStatus.COMPLETED;

  @ApiPropertyOptional({
    description: 'Method used for payment',
    enum: PaymentMethod,
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  payment_method?: PaymentMethod;

  @ApiProperty({
    description: 'Date the payment was made',
    example: '2024-01-15',
    format: 'date',
  })
  @IsDateString()
  payment_date: string;

  @ApiPropertyOptional({
    description: 'Due date for this payment',
    example: '2024-01-15',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @ApiPropertyOptional({
    description: 'Payment reference number',
    example: 'PAY-2024-001',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  reference_number?: string;

  @ApiPropertyOptional({
    description: 'Payment description',
    example: 'Monthly mortgage payment',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Additional notes about the payment',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Remaining loan balance after this payment',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  balance_after?: number;

  @ApiPropertyOptional({
    description: 'Additional payment metadata',
    example: { confirmationCode: 'ABC123', processingFee: 2.50 },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateLoanPaymentDto {
  @ApiPropertyOptional({
    description: 'Total payment amount',
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Transform(({ value }) => parseFloat(value))
  amount?: number;

  @ApiPropertyOptional({
    description: 'Portion of payment applied to principal',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  principal_amount?: number;

  @ApiPropertyOptional({
    description: 'Portion of payment applied to interest',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  interest_amount?: number;

  @ApiPropertyOptional({
    description: 'Portion of payment applied to fees',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  fee_amount?: number;

  @ApiPropertyOptional({
    description: 'Type of payment',
    enum: PaymentType,
  })
  @IsOptional()
  @IsEnum(PaymentType)
  type?: PaymentType;

  @ApiPropertyOptional({
    description: 'Payment status',
    enum: PaymentStatus,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Method used for payment',
    enum: PaymentMethod,
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  payment_method?: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Date the payment was made',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  payment_date?: string;

  @ApiPropertyOptional({
    description: 'Due date for this payment',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @ApiPropertyOptional({
    description: 'Payment reference number',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  reference_number?: string;

  @ApiPropertyOptional({
    description: 'Payment description',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Additional notes about the payment',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Remaining loan balance after this payment',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  balance_after?: number;

  @ApiPropertyOptional({
    description: 'Additional payment metadata',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class LoanPaymentSummaryDto {
  @ApiProperty({ description: 'Loan ID' })
  loan_id: string;

  @ApiProperty({ description: 'Total number of payments made' })
  total_payments: number;

  @ApiProperty({ description: 'Total amount paid' })
  total_amount_paid: number;

  @ApiProperty({ description: 'Total principal paid' })
  total_principal_paid: number;

  @ApiProperty({ description: 'Total interest paid' })
  total_interest_paid: number;

  @ApiProperty({ description: 'Total fees paid' })
  total_fees_paid: number;

  @ApiProperty({ description: 'Last payment date' })
  last_payment_date?: string;

  @ApiProperty({ description: 'Last payment amount' })
  last_payment_amount?: number;

  @ApiProperty({ description: 'Number of late payments' })
  late_payments_count: number;

  @ApiProperty({ description: 'Average payment amount' })
  average_payment_amount: number;

  @ApiProperty({ description: 'Payment history by month' })
  monthly_breakdown: Array<{
    month: string;
    payment_count: number;
    total_amount: number;
    principal_amount: number;
    interest_amount: number;
    fee_amount: number;
  }>;
}
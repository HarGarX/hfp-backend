import { IsNumber, IsOptional, IsPositive } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBalanceDto {
  @ApiProperty({
    description: 'Current account balance',
    example: 2500.50,
    type: 'number'
  })
  @IsNumber()
  current_balance: number;

  @ApiPropertyOptional({
    description: 'Available balance (optional, defaults to current_balance)',
    example: 2500.50,
    type: 'number'
  })
  @IsOptional()
  @IsNumber()
  available_balance?: number;
}
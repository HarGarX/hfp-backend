import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUUID,
  MaxLength,
  MinLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryType } from '../entities/category.entity';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Category name',
    example: 'Groceries',
    minLength: 1,
    maxLength: 255
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Type of category',
    enum: CategoryType,
    example: CategoryType.EXPENSE
  })
  @IsEnum(CategoryType)
  category_type: CategoryType;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Food and grocery expenses',
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Hex color code for UI display',
    example: '#FF5733',
    maxLength: 7
  })
  @IsOptional()
  @IsString()
  @MaxLength(7)
  color?: string;

  @ApiPropertyOptional({
    description: 'Icon identifier for UI display',
    example: 'shopping-cart',
    maxLength: 50
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({
    description: 'Whether the category is active',
    default: true
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Sort order for display',
    example: 1,
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sort_order?: number;

  @ApiPropertyOptional({
    description: 'Parent category ID for subcategories',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid'
  })
  @IsOptional()
  @IsUUID()
  parent_id?: string;

  @ApiPropertyOptional({
    description: 'Monthly budget limit for this category',
    example: 500.00,
    minimum: 0
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  budget_limit?: number;

  @ApiPropertyOptional({
    description: 'Budget period',
    example: 'monthly',
    enum: ['monthly', 'quarterly', 'annually']
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  budget_period?: string;
}
import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'newuser@example.com',
    format: 'email'
  })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'securePassword123',
    minLength: 6
  })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John'
  })
  @Transform(({ obj }) => obj.firstName ?? obj.first_name)
  @IsString({ message: 'First name must be a string' })
  @IsNotEmpty({ message: 'First name is required' })
  first_name: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe'
  })
  @Transform(({ obj }) => obj.lastName ?? obj.last_name)
  @IsString({ message: 'Last name must be a string' })
  @IsNotEmpty({ message: 'Last name is required' })
  last_name: string;

  @ApiPropertyOptional({
    description: 'Name of the household to create for this user',
    example: 'The Doe Family'
  })
  @IsOptional()
  @IsString({ message: 'Household name must be a string' })
  household_name?: string;
}
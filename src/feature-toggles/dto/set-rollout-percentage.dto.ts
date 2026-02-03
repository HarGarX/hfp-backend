import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';

export class SetRolloutPercentageDto {
  @ApiProperty({
    description: 'Rollout percentage (0-100)',
    example: 50,
    minimum: 0,
    maximum: 100,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  percentage: number;
}

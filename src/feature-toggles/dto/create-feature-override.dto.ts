import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsBoolean, IsOptional } from 'class-validator';

export class CreateFeatureOverrideDto {
  @ApiProperty({
    description: 'Household ID to apply the override to',
    example: '0fb3a24b-cd4e-46f7-ad64-8adb4c4bbf41',
  })
  @IsUUID()
  householdId: string;

  @ApiProperty({
    description: 'Whether the feature should be enabled for this household',
    example: true,
  })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({
    description: 'Reason for the override',
    example: 'Beta testing participant',
    required: false,
  })
  @IsString()
  @IsOptional()
  reason?: string;
}

import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateFeatureFlagDto } from './create-feature-flag.dto';

export class UpdateFeatureFlagDto extends PartialType(CreateFeatureFlagDto) {
  @ApiProperty({
    description: 'Unique key for the feature flag',
    example: 'insights.ai_recommendations',
    required: false,
  })
  key?: string;
}

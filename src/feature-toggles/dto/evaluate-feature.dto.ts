import { ApiProperty } from '@nestjs/swagger';

export class EvaluateFeatureDto {
  @ApiProperty({
    description: 'Feature flag key to evaluate',
    example: 'insights.ai_recommendations',
  })
  key: string;

  @ApiProperty({
    description: 'Whether the feature is enabled for the current context',
    example: true,
  })
  enabled: boolean;

  @ApiProperty({
    description: 'Reason for the evaluation result',
    example: 'Enabled via household override',
  })
  reason: string;
}

import { SetMetadata } from '@nestjs/common';

export const REQUIRE_FEATURE_KEY = 'requireFeature';

/**
 * Decorator to protect endpoints with feature flags
 * 
 * @example
 * @RequireFeature('insights.ai_recommendations')
 * @Get('recommendations')
 * getRecommendations() {
 *   // This endpoint will only be accessible if the feature is enabled
 * }
 */
export const RequireFeature = (featureKey: string) =>
  SetMetadata(REQUIRE_FEATURE_KEY, featureKey);

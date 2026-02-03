import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_FEATURE_KEY } from '../decorators/require-feature.decorator';
import { FeatureEvaluationService } from '../services/feature-evaluation.service';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  private readonly logger = new Logger(FeatureFlagGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly evaluationService: FeatureEvaluationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get the feature key from the decorator
    const featureKey = this.reflector.getAllAndOverride<string>(
      REQUIRE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no feature key is specified, allow access
    if (!featureKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Build evaluation context from the authenticated user
    const evaluationContext = {
      householdId: user?.household_id,
      userId: user?.id,
      userRole: user?.role,
      userEmail: user?.email,
    };

    this.logger.debug(
      `Checking feature flag: ${featureKey} for user ${user?.id}`,
    );

    // Evaluate the feature flag
    const result = await this.evaluationService.evaluate(
      featureKey,
      evaluationContext,
    );

    if (!result.enabled) {
      this.logger.warn(
        `Feature '${featureKey}' is not enabled for user ${user?.id}. Reason: ${result.reason}`,
      );
      throw new ForbiddenException(
        `Feature '${featureKey}' is not available. ${result.reason}`,
      );
    }

    this.logger.debug(
      `Feature '${featureKey}' is enabled for user ${user?.id}`,
    );
    return true;
  }
}

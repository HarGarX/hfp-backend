import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlag, FeatureOverride } from '../entities';
import { createHash } from 'crypto';

export interface EvaluationContext {
  householdId?: string;
  userId?: string;
  userRole?: string;
  userEmail?: string;
  additionalContext?: Record<string, any>;
}

export interface EvaluationResult {
  enabled: boolean;
  reason: string;
}

@Injectable()
export class FeatureEvaluationService {
  private readonly logger = new Logger(FeatureEvaluationService.name);

  constructor(
    @InjectRepository(FeatureFlag)
    private readonly featureFlagRepository: Repository<FeatureFlag>,
    @InjectRepository(FeatureOverride)
    private readonly featureOverrideRepository: Repository<FeatureOverride>,
  ) {}

  /**
   * Evaluate whether a feature is enabled for the given context
   */
  async evaluate(
    featureKey: string,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    this.logger.debug(
      `Evaluating feature: ${featureKey} for context: ${JSON.stringify(context)}`,
    );

    // Get the feature flag
    const featureFlag = await this.featureFlagRepository.findOne({
      where: { key: featureKey },
    });

    if (!featureFlag) {
      this.logger.warn(`Feature flag not found: ${featureKey}`);
      return {
        enabled: false,
        reason: 'Feature flag does not exist',
      };
    }

    // Check for household override first (highest priority)
    if (context.householdId) {
      const override = await this.featureOverrideRepository.findOne({
        where: {
          featureFlagId: featureFlag.id,
          householdId: context.householdId,
        },
      });

      if (override) {
        this.logger.debug(
          `Found household override for ${featureKey}: ${override.enabled}`,
        );
        return {
          enabled: override.enabled,
          reason: `Household override: ${override.reason || 'Manual override'}`,
        };
      }
    }

    // If feature is not globally enabled, return false
    if (!featureFlag.enabled) {
      return {
        enabled: false,
        reason: 'Feature is globally disabled',
      };
    }

    // Check role targeting
    if (
      featureFlag.targetRoles &&
      featureFlag.targetRoles.length > 0 &&
      context.userRole
    ) {
      if (!featureFlag.targetRoles.includes(context.userRole)) {
        return {
          enabled: false,
          reason: `User role '${context.userRole}' not in target roles`,
        };
      }
    }

    // Check household targeting
    if (
      featureFlag.targetHouseholds &&
      featureFlag.targetHouseholds.length > 0
    ) {
      if (!context.householdId) {
        return {
          enabled: false,
          reason: 'Household context required for targeted feature',
        };
      }

      if (!featureFlag.targetHouseholds.includes(context.householdId)) {
        return {
          enabled: false,
          reason: 'Household not in target list',
        };
      }
    }

    // Check rollout percentage (deterministic based on household/user ID)
    if (featureFlag.rolloutPercentage < 100) {
      const isInRollout = this.isInRolloutPercentage(
        featureKey,
        context.householdId || context.userId || '',
        featureFlag.rolloutPercentage,
      );

      if (!isInRollout) {
        return {
          enabled: false,
          reason: `Not in ${featureFlag.rolloutPercentage}% rollout`,
        };
      }
    }

    // Check custom conditions (if any)
    if (featureFlag.conditions && Object.keys(featureFlag.conditions).length > 0) {
      const conditionsMet = this.evaluateConditions(
        featureFlag.conditions,
        context,
      );

      if (!conditionsMet) {
        return {
          enabled: false,
          reason: 'Custom conditions not met',
        };
      }
    }

    // All checks passed
    return {
      enabled: true,
      reason: 'Feature enabled',
    };
  }

  /**
   * Deterministic rollout percentage check using hashing
   * Same household/user will always get the same result for a given feature
   */
  private isInRolloutPercentage(
    featureKey: string,
    identifier: string,
    percentage: number,
  ): boolean {
    if (percentage === 0) return false;
    if (percentage === 100) return true;

    // Create a deterministic hash from feature key + identifier
    const hash = createHash('md5')
      .update(`${featureKey}:${identifier}`)
      .digest('hex');

    // Convert first 8 characters to a number between 0-99
    const hashNumber = parseInt(hash.substring(0, 8), 16) % 100;

    return hashNumber < percentage;
  }

  /**
   * Evaluate custom conditions
   * This is a simple implementation - can be extended based on requirements
   */
  private evaluateConditions(
    conditions: Record<string, any>,
    context: EvaluationContext,
  ): boolean {
    // Simple equality checks for now
    // Can be extended to support operators like >, <, contains, etc.
    
    const combinedContext = {
      ...context,
      ...context.additionalContext,
    };

    for (const [key, expectedValue] of Object.entries(conditions)) {
      const actualValue = combinedContext[key];

      if (actualValue !== expectedValue) {
        this.logger.debug(
          `Condition not met: ${key} = ${actualValue}, expected ${expectedValue}`,
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a feature is enabled (simplified version for guard usage)
   */
  async isFeatureEnabled(
    featureKey: string,
    context: EvaluationContext,
  ): Promise<boolean> {
    const result = await this.evaluate(featureKey, context);
    return result.enabled;
  }
}

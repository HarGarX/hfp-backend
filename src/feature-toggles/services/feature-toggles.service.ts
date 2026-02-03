import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlag, FeatureOverride } from '../entities';
import {
  CreateFeatureFlagDto,
  UpdateFeatureFlagDto,
  CreateFeatureOverrideDto,
} from '../dto';
import { FeatureEvaluationService, EvaluationContext } from './feature-evaluation.service';

@Injectable()
export class FeatureTogglesService {
  private readonly logger = new Logger(FeatureTogglesService.name);

  constructor(
    @InjectRepository(FeatureFlag)
    private readonly featureFlagRepository: Repository<FeatureFlag>,
    @InjectRepository(FeatureOverride)
    private readonly featureOverrideRepository: Repository<FeatureOverride>,
    private readonly evaluationService: FeatureEvaluationService,
  ) {}

  /**
   * Create a new feature flag
   */
  async create(createDto: CreateFeatureFlagDto): Promise<FeatureFlag> {
    this.logger.log(`Creating feature flag: ${createDto.key}`);

    // Check if feature flag already exists
    const existing = await this.featureFlagRepository.findOne({
      where: { key: createDto.key },
    });

    if (existing) {
      throw new ConflictException(`Feature flag with key '${createDto.key}' already exists`);
    }

    const featureFlag = this.featureFlagRepository.create(createDto);
    return this.featureFlagRepository.save(featureFlag);
  }

  /**
   * Get all feature flags
   */
  async findAll(): Promise<FeatureFlag[]> {
    return this.featureFlagRepository.find({
      relations: ['overrides'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a feature flag by key
   */
  async findByKey(key: string): Promise<FeatureFlag> {
    const featureFlag = await this.featureFlagRepository.findOne({
      where: { key },
      relations: ['overrides'],
    });

    if (!featureFlag) {
      throw new NotFoundException(`Feature flag '${key}' not found`);
    }

    return featureFlag;
  }

  /**
   * Update a feature flag
   */
  async update(key: string, updateDto: UpdateFeatureFlagDto): Promise<FeatureFlag> {
    this.logger.log(`Updating feature flag: ${key}`);

    const featureFlag = await this.findByKey(key);

    // If updating the key, check for conflicts
    if (updateDto.key && updateDto.key !== key) {
      const existing = await this.featureFlagRepository.findOne({
        where: { key: updateDto.key },
      });

      if (existing) {
        throw new ConflictException(`Feature flag with key '${updateDto.key}' already exists`);
      }
    }

    Object.assign(featureFlag, updateDto);
    return this.featureFlagRepository.save(featureFlag);
  }

  /**
   * Delete a feature flag
   */
  async remove(key: string): Promise<void> {
    this.logger.log(`Deleting feature flag: ${key}`);

    const featureFlag = await this.findByKey(key);
    await this.featureFlagRepository.remove(featureFlag);
  }

  /**
   * Enable a feature flag globally
   */
  async enable(key: string): Promise<FeatureFlag> {
    this.logger.log(`Enabling feature flag: ${key}`);

    const featureFlag = await this.findByKey(key);
    featureFlag.enabled = true;
    return this.featureFlagRepository.save(featureFlag);
  }

  /**
   * Disable a feature flag globally
   */
  async disable(key: string): Promise<FeatureFlag> {
    this.logger.log(`Disabling feature flag: ${key}`);

    const featureFlag = await this.findByKey(key);
    featureFlag.enabled = false;
    return this.featureFlagRepository.save(featureFlag);
  }

  /**
   * Set rollout percentage for gradual rollout
   */
  async setRolloutPercentage(key: string, percentage: number): Promise<FeatureFlag> {
    this.logger.log(`Setting rollout percentage for ${key} to ${percentage}%`);

    const featureFlag = await this.findByKey(key);
    featureFlag.rolloutPercentage = percentage;
    return this.featureFlagRepository.save(featureFlag);
  }

  /**
   * Evaluate a feature flag for the given context
   */
  async evaluate(key: string, context: EvaluationContext) {
    const result = await this.evaluationService.evaluate(key, context);

    return {
      key,
      enabled: result.enabled,
      reason: result.reason,
    };
  }

  /**
   * Create or update a household override
   */
  async createOverride(
    key: string,
    createOverrideDto: CreateFeatureOverrideDto,
  ): Promise<FeatureOverride> {
    this.logger.log(
      `Creating override for ${key} and household ${createOverrideDto.householdId}`,
    );

    const featureFlag = await this.findByKey(key);

    // Check if override already exists
    const existing = await this.featureOverrideRepository.findOne({
      where: {
        featureFlagId: featureFlag.id,
        householdId: createOverrideDto.householdId,
      },
    });

    if (existing) {
      // Update existing override
      Object.assign(existing, {
        enabled: createOverrideDto.enabled,
        reason: createOverrideDto.reason,
      });
      return this.featureOverrideRepository.save(existing);
    }

    // Create new override
    const override = this.featureOverrideRepository.create({
      featureFlagId: featureFlag.id,
      householdId: createOverrideDto.householdId,
      enabled: createOverrideDto.enabled,
      reason: createOverrideDto.reason,
    });

    return this.featureOverrideRepository.save(override);
  }

  /**
   * Get all overrides for a feature flag
   */
  async getOverrides(key: string): Promise<FeatureOverride[]> {
    const featureFlag = await this.findByKey(key);

    return this.featureOverrideRepository.find({
      where: { featureFlagId: featureFlag.id },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Remove a household override
   */
  async removeOverride(key: string, householdId: string): Promise<void> {
    this.logger.log(`Removing override for ${key} and household ${householdId}`);

    const featureFlag = await this.findByKey(key);

    const override = await this.featureOverrideRepository.findOne({
      where: {
        featureFlagId: featureFlag.id,
        householdId,
      },
    });

    if (!override) {
      throw new NotFoundException(
        `Override not found for feature '${key}' and household '${householdId}'`,
      );
    }

    await this.featureOverrideRepository.remove(override);
  }
}

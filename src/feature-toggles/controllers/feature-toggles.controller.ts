import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureTogglesService } from '../services/feature-toggles.service';
import {
  CreateFeatureFlagDto,
  UpdateFeatureFlagDto,
  CreateFeatureOverrideDto,
  EvaluateFeatureDto,
  SetRolloutPercentageDto,
} from '../dto';
import { FeatureFlag, FeatureOverride } from '../entities';

@ApiTags('Feature Toggles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('feature-flags')
export class FeatureTogglesController {
  constructor(private readonly featureTogglesService: FeatureTogglesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new feature flag' })
  @ApiResponse({
    status: 201,
    description: 'Feature flag created successfully',
    type: FeatureFlag,
  })
  @ApiResponse({ status: 409, description: 'Feature flag already exists' })
  async create(
    @Body() createDto: CreateFeatureFlagDto,
  ): Promise<FeatureFlag> {
    return this.featureTogglesService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all feature flags' })
  @ApiResponse({
    status: 200,
    description: 'List of all feature flags',
    type: [FeatureFlag],
  })
  async findAll(): Promise<FeatureFlag[]> {
    return this.featureTogglesService.findAll();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a feature flag by key' })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiResponse({
    status: 200,
    description: 'Feature flag details',
    type: FeatureFlag,
  })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async findOne(@Param('key') key: string): Promise<FeatureFlag> {
    return this.featureTogglesService.findByKey(key);
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update a feature flag' })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiResponse({
    status: 200,
    description: 'Feature flag updated successfully',
    type: FeatureFlag,
  })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async update(
    @Param('key') key: string,
    @Body() updateDto: UpdateFeatureFlagDto,
  ): Promise<FeatureFlag> {
    return this.featureTogglesService.update(key, updateDto);
  }

  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a feature flag' })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiResponse({ status: 204, description: 'Feature flag deleted successfully' })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async remove(@Param('key') key: string): Promise<void> {
    return this.featureTogglesService.remove(key);
  }

  @Post(':key/enable')
  @ApiOperation({ summary: 'Enable a feature flag globally' })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiResponse({
    status: 200,
    description: 'Feature flag enabled',
    type: FeatureFlag,
  })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async enable(@Param('key') key: string): Promise<FeatureFlag> {
    return this.featureTogglesService.enable(key);
  }

  @Post(':key/disable')
  @ApiOperation({ summary: 'Disable a feature flag globally' })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiResponse({
    status: 200,
    description: 'Feature flag disabled',
    type: FeatureFlag,
  })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async disable(@Param('key') key: string): Promise<FeatureFlag> {
    return this.featureTogglesService.disable(key);
  }

  @Post(':key/rollout/:percentage')
  @ApiOperation({ summary: 'Set rollout percentage for gradual feature release' })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiParam({
    name: 'percentage',
    description: 'Rollout percentage (0-100)',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Rollout percentage updated',
    type: FeatureFlag,
  })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async setRollout(
    @Param('key') key: string,
    @Param('percentage') percentage: number,
  ): Promise<FeatureFlag> {
    return this.featureTogglesService.setRolloutPercentage(key, percentage);
  }

  @Get(':key/evaluate')
  @ApiOperation({
    summary: 'Evaluate if a feature is enabled for the current user',
  })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiResponse({
    status: 200,
    description: 'Evaluation result',
    type: EvaluateFeatureDto,
  })
  async evaluate(
    @Param('key') key: string,
    @Request() req: any,
  ): Promise<EvaluateFeatureDto> {
    const context = {
      householdId: req.user?.household_id,
      userId: req.user?.id,
      userRole: req.user?.role,
      userEmail: req.user?.email,
    };

    return this.featureTogglesService.evaluate(key, context);
  }

  @Post(':key/overrides')
  @ApiOperation({ summary: 'Create or update a household override' })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiResponse({
    status: 201,
    description: 'Override created successfully',
    type: FeatureOverride,
  })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async createOverride(
    @Param('key') key: string,
    @Body() createOverrideDto: CreateFeatureOverrideDto,
  ): Promise<FeatureOverride> {
    return this.featureTogglesService.createOverride(key, createOverrideDto);
  }

  @Get(':key/overrides')
  @ApiOperation({ summary: 'Get all overrides for a feature flag' })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiResponse({
    status: 200,
    description: 'List of overrides',
    type: [FeatureOverride],
  })
  async getOverrides(@Param('key') key: string): Promise<FeatureOverride[]> {
    return this.featureTogglesService.getOverrides(key);
  }

  @Delete(':key/overrides/:householdId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a household override' })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiParam({ name: 'householdId', description: 'Household ID' })
  @ApiResponse({ status: 204, description: 'Override removed successfully' })
  @ApiResponse({ status: 404, description: 'Override not found' })
  async removeOverride(
    @Param('key') key: string,
    @Param('householdId') householdId: string,
  ): Promise<void> {
    return this.featureTogglesService.removeOverride(key, householdId);
  }
}

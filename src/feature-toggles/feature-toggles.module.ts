import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlag, FeatureOverride } from './entities';
import { FeatureTogglesService, FeatureEvaluationService } from './services';
import { FeatureTogglesController } from './controllers';
import { FeatureFlagGuard } from './guards';

@Module({
  imports: [TypeOrmModule.forFeature([FeatureFlag, FeatureOverride])],
  controllers: [FeatureTogglesController],
  providers: [
    FeatureTogglesService,
    FeatureEvaluationService,
    FeatureFlagGuard,
  ],
  exports: [
    FeatureTogglesService,
    FeatureEvaluationService,
    FeatureFlagGuard,
  ],
})
export class FeatureTogglesModule {}

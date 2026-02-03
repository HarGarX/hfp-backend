import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { NotificationDigestProcessor } from './processors/notification-digest.processor';
import { HealthScoreProcessor } from './processors/health-score.processor';
import { InsightGenerationProcessor } from './processors/insight-generation.processor';
import { NotificationsModule } from '../notifications/notifications.module';
import { InsightsModule } from '../insights/insights.module';

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: 'notification-digest',
        defaultJobOptions: {
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 500,     // Keep last 500 failed jobs
        },
      },
      {
        name: 'health-score',
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      },
      {
        name: 'insight-generation',
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }
    ),
    NotificationsModule,
    InsightsModule,
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    NotificationDigestProcessor,
    HealthScoreProcessor,
    InsightGenerationProcessor,
  ],
  exports: [JobsService],
})
export class JobsModule {}

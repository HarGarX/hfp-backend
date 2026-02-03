import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue, Job } from 'bull';
import {
  NotificationDigestJobData,
} from './processors/notification-digest.processor';
import { HealthScoreJobData } from './processors/health-score.processor';
import { InsightGenerationJobData } from './processors/insight-generation.processor';

export interface JobStatus {
  id: string;
  name: string;
  data: any;
  progress: number;
  state: string;
  attemptsMade: number;
  finishedOn?: number;
  processedOn?: number;
  failedReason?: string;
  returnvalue?: any;
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue('notification-digest') private notificationDigestQueue: Queue,
    @InjectQueue('health-score') private healthScoreQueue: Queue,
    @InjectQueue('insight-generation') private insightGenerationQueue: Queue,
  ) {}

  // Notification Digest Jobs
  async scheduleNotificationDigest(
    data: NotificationDigestJobData,
    delay?: number
  ): Promise<Job> {
    this.logger.log(`Scheduling notification digest for household: ${data.householdId}`);
    
    return this.notificationDigestQueue.add('generate-digest', data, {
      delay,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }

  async scheduleRecurringDigest(
    householdId: string,
    digestType: 'daily' | 'weekly' | 'monthly',
    cronExpression: string
  ): Promise<void> {
    this.logger.log(`Scheduling recurring ${digestType} digest for household: ${householdId}`);
    
    // Remove existing recurring job if any
    const existingJobs = await this.notificationDigestQueue.getRepeatableJobs();
    const existingJob = existingJobs.find(
      job => job.name === `digest-${householdId}-${digestType}`
    );
    
    if (existingJob) {
      await this.notificationDigestQueue.removeRepeatableByKey(existingJob.key);
    }

    // Schedule new recurring job
    await this.notificationDigestQueue.add(
      'generate-digest',
      {
        householdId,
        digestType,
      } as NotificationDigestJobData,
      {
        repeat: {
          cron: cronExpression,
        },
        jobId: `digest-${householdId}-${digestType}`,
      }
    );
  }

  // Health Score Jobs
  async calculateHealthScore(
    householdId: string,
    forceRecalculation = false
  ): Promise<Job> {
    this.logger.log(`Scheduling health score calculation for household: ${householdId}`);
    
    return this.healthScoreQueue.add(
      'calculate-score',
      { householdId, forceRecalculation } as HealthScoreJobData,
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      }
    );
  }

  async batchCalculateHealthScores(householdIds: string[]): Promise<Job> {
    this.logger.log(`Scheduling batch health score calculation for ${householdIds.length} households`);
    
    return this.healthScoreQueue.add(
      'batch-calculate',
      { householdIds },
      {
        attempts: 2,
        timeout: 300000, // 5 minutes
      }
    );
  }

  async scheduleRecurringHealthScore(
    householdId: string,
    cronExpression: string
  ): Promise<void> {
    this.logger.log(`Scheduling recurring health score for household: ${householdId}`);
    
    await this.healthScoreQueue.add(
      'calculate-score',
      { householdId } as HealthScoreJobData,
      {
        repeat: {
          cron: cronExpression,
        },
        jobId: `health-score-${householdId}`,
      }
    );
  }

  // Insight Generation Jobs
  async generateInsights(data: InsightGenerationJobData): Promise<Job> {
    this.logger.log(`Scheduling insight generation for household: ${data.householdId}`);
    
    return this.insightGenerationQueue.add('generate-insights', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }

  async batchGenerateInsights(householdIds: string[]): Promise<Job> {
    this.logger.log(`Scheduling batch insight generation for ${householdIds.length} households`);
    
    return this.insightGenerationQueue.add(
      'batch-generate',
      { householdIds },
      {
        attempts: 2,
        timeout: 600000, // 10 minutes
      }
    );
  }

  async scheduleRecurringInsights(
    householdId: string,
    cronExpression: string
  ): Promise<void> {
    this.logger.log(`Scheduling recurring insights for household: ${householdId}`);
    
    await this.insightGenerationQueue.add(
      'generate-insights',
      { householdId } as InsightGenerationJobData,
      {
        repeat: {
          cron: cronExpression,
        },
        jobId: `insights-${householdId}`,
      }
    );
  }

  // Job Status and Management
  async getJobStatus(queueName: string, jobId: string): Promise<JobStatus | null> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      return null;
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    
    return {
      id: job.id.toString(),
      name: job.name,
      data: job.data,
      progress: job.progress(),
      state,
      attemptsMade: job.attemptsMade,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
    };
  }

  async getQueueStats(queueName: string) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      return null;
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  async getAllQueueStats() {
    const [notificationDigest, healthScore, insightGeneration] = await Promise.all([
      this.getQueueStats('notification-digest'),
      this.getQueueStats('health-score'),
      this.getQueueStats('insight-generation'),
    ]);

    return {
      notificationDigest,
      healthScore,
      insightGeneration,
    };
  }

  async retryFailedJobs(queueName: string): Promise<number> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      return 0;
    }

    const failedJobs = await queue.getFailed();
    
    for (const job of failedJobs) {
      await job.retry();
    }

    this.logger.log(`Retried ${failedJobs.length} failed jobs in ${queueName}`);
    return failedJobs.length;
  }

  async cleanQueue(queueName: string, grace: number = 0): Promise<void> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      return;
    }

    await queue.clean(grace, 'completed');
    await queue.clean(grace, 'failed');
    
    this.logger.log(`Cleaned ${queueName} queue`);
  }

  private getQueue(queueName: string): Queue | null {
    switch (queueName) {
      case 'notification-digest':
        return this.notificationDigestQueue;
      case 'health-score':
        return this.healthScoreQueue;
      case 'insight-generation':
        return this.insightGenerationQueue;
      default:
        return null;
    }
  }
}

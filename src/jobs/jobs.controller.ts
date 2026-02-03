import { Controller, Get, Post, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdGuard } from '../shared/guards/household.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentHousehold } from '../shared/decorators/current-household.decorator';
import { JobsService } from './jobs.service';

@ApiTags('Jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HouseholdGuard)
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post('digest/trigger')
  @ApiOperation({ summary: 'Trigger notification digest generation' })
  @ApiResponse({ status: 201, description: 'Digest job scheduled successfully' })
  async triggerDigest(
    @CurrentHousehold() householdId: string,
    @CurrentUser('userId') userId: string,
    @Body() body: { digestType: 'daily' | 'weekly' | 'monthly' }
  ) {
    const now = new Date();
    const job = await this.jobsService.scheduleNotificationDigest({
      householdId,
      userId,
      periodStart: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Last 24 hours
      periodEnd: now,
      digestType: body.digestType,
    });

    return {
      message: 'Notification digest job scheduled',
      jobId: job.id,
    };
  }

  @Post('health-score/calculate')
  @ApiOperation({ summary: 'Trigger health score calculation' })
  @ApiResponse({ status: 201, description: 'Health score calculation scheduled' })
  async calculateHealthScore(
    @CurrentHousehold() householdId: string,
    @Body() body: { forceRecalculation?: boolean }
  ) {
    const job = await this.jobsService.calculateHealthScore(
      householdId,
      body.forceRecalculation
    );

    return {
      message: 'Health score calculation scheduled',
      jobId: job.id,
    };
  }

  @Post('insights/generate')
  @ApiOperation({ summary: 'Trigger insight generation' })
  @ApiResponse({ status: 201, description: 'Insight generation scheduled' })
  async generateInsights(
    @CurrentHousehold() householdId: string,
    @Body() body: { insightTypes?: string[] }
  ) {
    const job = await this.jobsService.generateInsights({
      householdId,
      insightTypes: body.insightTypes as any,
    });

    return {
      message: 'Insight generation scheduled',
      jobId: job.id,
    };
  }

  @Get('status/:queueName/:jobId')
  @ApiOperation({ summary: 'Get job status' })
  @ApiResponse({ status: 200, description: 'Job status retrieved' })
  async getJobStatus(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string
  ) {
    const status = await this.jobsService.getJobStatus(queueName, jobId);
    
    if (!status) {
      return {
        message: 'Job not found',
      };
    }

    return status;
  }

  @Get('queues/stats')
  @ApiOperation({ summary: 'Get all queue statistics' })
  @ApiResponse({ status: 200, description: 'Queue statistics retrieved' })
  async getQueueStats() {
    return this.jobsService.getAllQueueStats();
  }

  @Get('queue/:queueName/stats')
  @ApiOperation({ summary: 'Get specific queue statistics' })
  @ApiResponse({ status: 200, description: 'Queue statistics retrieved' })
  async getSpecificQueueStats(@Param('queueName') queueName: string) {
    const stats = await this.jobsService.getQueueStats(queueName);
    
    if (!stats) {
      return {
        message: 'Queue not found',
      };
    }

    return stats;
  }

  @Post('queue/:queueName/retry-failed')
  @ApiOperation({ summary: 'Retry all failed jobs in a queue' })
  @ApiResponse({ status: 200, description: 'Failed jobs retried' })
  async retryFailedJobs(@Param('queueName') queueName: string) {
    const count = await this.jobsService.retryFailedJobs(queueName);
    
    return {
      message: `Retried ${count} failed jobs`,
      count,
    };
  }

  @Post('queue/:queueName/clean')
  @ApiOperation({ summary: 'Clean completed and failed jobs from queue' })
  @ApiResponse({ status: 200, description: 'Queue cleaned' })
  async cleanQueue(
    @Param('queueName') queueName: string,
    @Query('grace') grace?: number
  ) {
    await this.jobsService.cleanQueue(queueName, grace);
    
    return {
      message: 'Queue cleaned successfully',
    };
  }
}

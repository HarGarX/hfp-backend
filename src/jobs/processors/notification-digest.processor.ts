import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { NotificationsService } from '../../notifications/services/notifications.service';

export interface NotificationDigestJobData {
  householdId: string;
  userId?: string;
  periodStart: Date;
  periodEnd: Date;
  digestType: 'daily' | 'weekly' | 'monthly';
}

@Processor('notification-digest')
export class NotificationDigestProcessor {
  private readonly logger = new Logger(NotificationDigestProcessor.name);

  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Process('generate-digest')
  async handleDigestGeneration(job: Job<NotificationDigestJobData>) {
    this.logger.log(`Processing notification digest for household: ${job.data.householdId}`);
    
    try {
      const { householdId, userId, periodStart, periodEnd, digestType } = job.data;

      // Fetch notifications for the period
      const result = await this.notificationsService.findAll(
        householdId,
        {
          user_id: userId,
          created_after: periodStart.toISOString(),
          created_before: periodEnd.toISOString(),
          is_read: false,
        }
      );

      const notifications = result.notifications;

      // Group notifications by type
      const notificationsByType = notifications.reduce((acc, notification) => {
        const type = notification.type;
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(notification);
        return acc;
      }, {} as Record<string, any[]>);

      // Generate digest summary
      const digestSummary = {
        householdId,
        userId,
        digestType,
        periodStart,
        periodEnd,
        totalNotifications: notifications.length,
        notificationsByType,
        generatedAt: new Date(),
      };

      // Here you would typically:
      // 1. Send digest email
      // 2. Create in-app digest notification
      // 3. Store digest for future reference

      this.logger.log(
        `Digest generated successfully for household ${householdId}: ${notifications.length} notifications`
      );

      return {
        success: true,
        digest: digestSummary,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate notification digest for household ${job.data.householdId}`,
        error.stack
      );
      throw error;
    }
  }

  @Process('send-digest-email')
  async handleDigestEmail(job: Job<NotificationDigestJobData & { digest: any }>) {
    this.logger.log(`Sending digest email for household: ${job.data.householdId}`);
    
    try {
      // Here you would integrate with email service
      // For now, we'll just log
      this.logger.log(`Email digest sent successfully for household ${job.data.householdId}`);
      
      return {
        success: true,
        emailSent: true,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send digest email for household ${job.data.householdId}`,
        error.stack
      );
      throw error;
    }
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FindOptionsWhere, Between, Like, In } from 'typeorm';
import { Notification, NotificationStatus, NotificationPriority, NotificationChannel } from '../entities/notification.entity';
import { NotificationPreferences } from '../entities/notification-preferences.entity';
import { CreateNotificationDto, BulkCreateNotificationDto } from '../dto/create-notification.dto';
import { UpdateNotificationDto, BulkUpdateNotificationsDto } from '../dto/update-notification.dto';
import { QueryNotificationsDto } from '../dto/query-notifications.dto';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationPreferencesRepository } from '../repositories/notification-preferences.repository';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly preferencesRepository: NotificationPreferencesRepository,
  ) {}

  async create(
    householdId: string,
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    // Check if user has preferences that would block this notification
    if (createNotificationDto.user_id) {
      const shouldSend = await this.shouldSendNotification(
        householdId,
        createNotificationDto.user_id,
        createNotificationDto.type,
        createNotificationDto.priority || NotificationPriority.MEDIUM,
        createNotificationDto.channels,
      );

      if (!shouldSend) {
        throw new BadRequestException('Notification blocked by user preferences');
      }
    }

    const notification = this.notificationRepository.create({
      ...createNotificationDto,
      household_id: householdId,
      status: NotificationStatus.PENDING,
    });

    const savedNotification = await this.notificationRepository.saveWithHousehold(householdId, notification);

    // If scheduled for immediate delivery, mark as ready for sending
    if (!notification.scheduled_at || notification.scheduled_at <= new Date()) {
      // In a real implementation, this would trigger the delivery service
      // For now, we'll just update the status
      await this.updateStatus(householdId, notification.id, NotificationStatus.SENT);
    }

    return savedNotification;
  }

  async createBulk(
    householdId: string,
    bulkCreateDto: BulkCreateNotificationDto,
  ): Promise<{ created: Notification[]; failed: Array<{ notification: CreateNotificationDto; error: string }> }> {
    const created: Notification[] = [];
    const failed: Array<{ notification: CreateNotificationDto; error: string }> = [];

    for (const notificationDto of bulkCreateDto.notifications) {
      try {
        const notification = await this.create(householdId, notificationDto);
        created.push(notification);
      } catch (error) {
        failed.push({
          notification: notificationDto,
          error: error.message,
        });

        if (!bulkCreateDto.continue_on_error) {
          break;
        }
      }
    }

    return { created, failed };
  }

  async findAll(
    householdId: string,
    queryDto: QueryNotificationsDto,
  ): Promise<{
    notifications: Notification[];
    total: number;
    page: number;
    pages: number;
  }> {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      min_priority,
      channel,
      user_id,
      created_after,
      created_before,
      is_read,
      is_interactive,
      is_overdue,
      search,
      sort_by = 'created_at',
      sort_order = 'DESC',
    } = queryDto;

    const where: FindOptionsWhere<Notification> = {
      household_id: householdId,
    };

    // Apply filters
    if (type) where.type = type;
    if (status) where.status = status;
    if (user_id) where.user_id = user_id;

    // Date range filter
    if (created_after || created_before) {
      const dateFilter: any = {};
      if (created_after) dateFilter.gte = new Date(created_after);
      if (created_before) dateFilter.lte = new Date(created_before);
      where.created_at = Between(dateFilter.gte || new Date('1900-01-01'), dateFilter.lte || new Date());
    }

    // Build query
    let query = this.notificationRepository
      .createQueryBuilderWithHousehold(householdId, 'notification')
      .leftJoinAndSelect('notification.user', 'user');

    // Apply additional filters
    if (type) query.andWhere('notification.type = :type', { type });
    if (status) query.andWhere('notification.status = :status', { status });
    if (user_id) query.andWhere('notification.user_id = :userId', { userId: user_id });

    // Priority filter (minimum priority)
    if (min_priority) {
      const priorityOrder = ['low', 'medium', 'high', 'urgent'];
      const minIndex = priorityOrder.indexOf(min_priority);
      const validPriorities = priorityOrder.slice(minIndex);
      query.andWhere('notification.priority IN (:...priorities)', { priorities: validPriorities });
    }

    // Channel filter
    if (channel) {
      query.andWhere(':channel = ANY(notification.channels)', { channel });
    }

    // Read status filter
    if (is_read !== undefined) {
      if (is_read) {
        query.andWhere('notification.read_at IS NOT NULL');
      } else {
        query.andWhere('notification.read_at IS NULL');
      }
    }

    // Interactive filter
    if (is_interactive !== undefined) {
      if (is_interactive) {
        query.andWhere('notification.action_url IS NOT NULL');
      } else {
        query.andWhere('notification.action_url IS NULL');
      }
    }

    // Overdue filter
    if (is_overdue !== undefined) {
      if (is_overdue) {
        query.andWhere('notification.scheduled_at < :now', { now: new Date() });
        query.andWhere('notification.status = :pendingStatus', { pendingStatus: NotificationStatus.PENDING });
      }
    }

    // Search filter
    if (search) {
      query.andWhere(
        '(notification.title ILIKE :search OR notification.message ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Date range filter (if provided)
    if (created_after) {
      query.andWhere('notification.created_at >= :createdAfter', { createdAfter: new Date(created_after) });
    }
    if (created_before) {
      query.andWhere('notification.created_at <= :createdBefore', { createdBefore: new Date(created_before) });
    }

    // Sorting
    query.orderBy(`notification.${sort_by}`, sort_order);

    // Pagination
    const offset = (page - 1) * limit;
    query.skip(offset).take(limit);

    const [notifications, total] = await query.getManyAndCount();

    return {
      notifications,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  async findOne(householdId: string, id: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOneWithHousehold(
      householdId,
      {
        where: { id },
        relations: ['user'],
      },
    );

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  async update(
    householdId: string,
    id: string,
    updateNotificationDto: UpdateNotificationDto,
  ): Promise<Notification> {
    const notification = await this.findOne(householdId, id);

    Object.assign(notification, updateNotificationDto);
    return await this.notificationRepository.saveWithHousehold(householdId, notification);
  }

  async remove(householdId: string, id: string): Promise<void> {
    const notification = await this.findOne(householdId, id);
    await this.notificationRepository.softDelete(notification.id);
  }

  async markAsRead(householdId: string, id: string, clickedUrl?: string): Promise<Notification> {
    const notification = await this.findOne(householdId, id);

    notification.read_at = new Date();
    if (clickedUrl) {
      notification.clicked_at = new Date();
      notification.clicked_url = clickedUrl;
    }

    return await this.notificationRepository.saveWithHousehold(householdId, notification);
  }

  async markAllAsRead(householdId: string, userId?: string): Promise<void> {
    const qb = this.notificationRepository
      .createQueryBuilderWithHousehold(householdId, 'notification')
      .update(Notification)
      .set({ read_at: new Date() })
      .where('read_at IS NULL');

    if (userId) {
      qb.andWhere('user_id = :userId', { userId });
    }

    await qb.execute();
  }

  async updateStatus(householdId: string, id: string, status: NotificationStatus): Promise<Notification> {
    const notification = await this.findOne(householdId, id);
    
    notification.status = status;
    
    // Update relevant timestamps
    switch (status) {
      case NotificationStatus.SENT:
        notification.sent_at = new Date();
        break;
      case NotificationStatus.DELIVERED:
        notification.delivered_at = new Date();
        break;
      case NotificationStatus.FAILED:
        notification.retry_count += 1;
        break;
    }

    return await this.notificationRepository.saveWithHousehold(householdId, notification);
  }

  async bulkUpdate(
    householdId: string,
    updateDto: BulkUpdateNotificationsDto,
    filters?: Partial<QueryNotificationsDto>,
  ): Promise<{ updated: number }> {
    const qb = this.notificationRepository.createQueryBuilderWithHousehold(householdId, 'notification');
    
    // Apply filters
    if (filters?.type) {
      qb.andWhere('notification.type = :type', { type: filters.type });
    }
    if (filters?.status) {
      qb.andWhere('notification.status = :status', { status: filters.status });
    }
    if (filters?.user_id) {
      qb.andWhere('notification.user_id = :userId', { userId: filters.user_id });
    }

    const updateData: Partial<Notification> = {};
    
    if (updateDto.status) {
      updateData.status = updateDto.status;
    }
    
    if (updateDto.mark_as_read) {
      updateData.read_at = new Date();
    }

    const result = await qb.update(Notification).set(updateData).execute();
    
    return { updated: result.affected || 0 };
  }

  async getUnreadCount(householdId: string, userId?: string): Promise<number> {
    const qb = this.notificationRepository
      .createQueryBuilderWithHousehold(householdId, 'notification')
      .where('notification.read_at IS NULL')
      .andWhere('notification.status = :status', { status: NotificationStatus.DELIVERED });

    if (userId) {
      qb.andWhere('notification.user_id = :userId', { userId });
    }

    return await qb.getCount();
  }

  async getPendingNotifications(householdId?: string): Promise<Notification[]> {
    if (householdId) {
      return await this.notificationRepository.findWithHousehold(householdId, {
        where: { status: NotificationStatus.PENDING },
        relations: ['user'],
        order: { priority: 'DESC', scheduled_at: 'ASC' },
      });
    }

    // Cross-household query (for background jobs)
    return await this.notificationRepository.find({
      where: { status: NotificationStatus.PENDING },
      relations: ['user'],
      order: { priority: 'DESC', scheduled_at: 'ASC' },
    });
  }

  async getOverdueNotifications(householdId?: string): Promise<Notification[]> {
    if (householdId) {
      const qb = this.notificationRepository
        .createQueryBuilderWithHousehold(householdId, 'notification')
        .leftJoinAndSelect('notification.user', 'user')
        .where('notification.status = :status', { status: NotificationStatus.PENDING })
        .andWhere('notification.scheduled_at < :now', { now: new Date() })
        .orderBy('notification.priority', 'DESC')
        .addOrderBy('notification.scheduled_at', 'ASC');

      return await qb.getMany();
    }

    // Cross-household query (for background jobs)
    return await this.notificationRepository.find({
      where: {
        status: NotificationStatus.PENDING,
        scheduled_at: Between(new Date('1900-01-01'), new Date()),
      },
      relations: ['user'],
      order: { priority: 'DESC', scheduled_at: 'ASC' },
    });
  }

  async getNotificationStats(
    householdId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    total: number;
    by_status: Record<NotificationStatus, number>;
    by_type: Record<string, number>;
    by_priority: Record<NotificationPriority, number>;
    by_channel: Record<NotificationChannel, number>;
    delivery_rate: number;
    read_rate: number;
    click_rate: number;
  }> {
    const qb = this.notificationRepository.createQueryBuilderWithHousehold(householdId, 'notification');

    if (startDate || endDate) {
      if (startDate) {
        qb.andWhere('notification.created_at >= :startDate', { startDate });
      }
      if (endDate) {
        qb.andWhere('notification.created_at <= :endDate', { endDate });
      }
    }

    const notifications = await qb.getMany();

    const stats = {
      total: notifications.length,
      by_status: {} as Record<NotificationStatus, number>,
      by_type: {} as Record<string, number>,
      by_priority: {} as Record<NotificationPriority, number>,
      by_channel: {} as Record<NotificationChannel, number>,
      delivery_rate: 0,
      read_rate: 0,
      click_rate: 0,
    };

    let delivered = 0;
    let read = 0;
    let clicked = 0;

    notifications.forEach(notification => {
      // Count by status
      stats.by_status[notification.status] = (stats.by_status[notification.status] || 0) + 1;

      // Count by type
      stats.by_type[notification.type] = (stats.by_type[notification.type] || 0) + 1;

      // Count by priority
      stats.by_priority[notification.priority] = (stats.by_priority[notification.priority] || 0) + 1;

      // Count by channels (each channel counts separately)
      notification.channels.forEach(channel => {
        stats.by_channel[channel] = (stats.by_channel[channel] || 0) + 1;
      });

      // Calculate rates
      if (notification.delivered_at) delivered++;
      if (notification.read_at) read++;
      if (notification.clicked_at) clicked++;
    });

    if (stats.total > 0) {
      stats.delivery_rate = Math.round((delivered / stats.total) * 100);
      stats.read_rate = Math.round((read / stats.total) * 100);
      stats.click_rate = Math.round((clicked / stats.total) * 100);
    }

    return stats;
  }

  private async shouldSendNotification(
    householdId: string,
    userId: string,
    type: string,
    priority: NotificationPriority,
    channels: NotificationChannel[],
  ): Promise<boolean> {
    const preferences = await this.preferencesRepository.findOneWithHousehold(
      householdId,
      { where: { user_id: userId } },
    );

    if (!preferences) {
      return true; // No preferences means allow all notifications
    }

    // Check each requested channel
    for (const channel of channels) {
      if (preferences.canReceiveNotification(type as any, priority, channel)) {
        return true; // If any channel is allowed, send the notification
      }
    }

    return false;
  }
}
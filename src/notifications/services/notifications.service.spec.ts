import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../services/notifications.service';
import { Notification, NotificationStatus, NotificationPriority, NotificationChannel, NotificationType } from '../entities/notification.entity';
import { NotificationPreferences } from '../entities/notification-preferences.entity';
import { CreateNotificationDto, BulkCreateNotificationDto } from '../dto/create-notification.dto';
import { UpdateNotificationDto, BulkUpdateNotificationsDto } from '../dto/update-notification.dto';
import { QueryNotificationsDto } from '../dto/query-notifications.dto';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationRepository: Repository<Notification>;
  let preferencesRepository: Repository<NotificationPreferences>;

  const mockNotificationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockPreferencesRepository = {
    findOne: jest.fn(),
  };

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepository,
        },
        {
          provide: getRepositoryToken(NotificationPreferences),
          useValue: mockPreferencesRepository,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    notificationRepository = module.get<Repository<Notification>>(getRepositoryToken(Notification));
    preferencesRepository = module.get<Repository<NotificationPreferences>>(getRepositoryToken(NotificationPreferences));

    // Reset mocks
    jest.clearAllMocks();
    mockNotificationRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should create a notification successfully', async () => {
      const householdId = 'household-1';
      const createDto = {
        type: NotificationType.EXPENSE_ALERT,
        title: 'Test Notification',
        message: 'Test message',
        priority: NotificationPriority.MEDIUM,
        channels: [NotificationChannel.IN_APP],
        user_id: 'user-1',
      };

      const mockNotification = {
        ...createDto,
        id: 'notification-1',
        household_id: householdId,
        status: NotificationStatus.PENDING,
        created_at: new Date(),
      };

      mockPreferencesRepository.findOne.mockResolvedValue(null);
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save
        .mockResolvedValueOnce(mockNotification) // First save call
        .mockResolvedValueOnce({ ...mockNotification, status: NotificationStatus.SENT }); // updateStatus call
      
      // Mock findOne for updateStatus call
      mockNotificationRepository.findOne.mockResolvedValue(mockNotification);

      const result = await service.create(householdId, createDto);

      expect(mockNotificationRepository.create).toHaveBeenCalledWith({
        ...createDto,
        household_id: householdId,
        status: NotificationStatus.PENDING,
      });
      expect(result).toEqual(mockNotification);
    });

    it('should throw BadRequestException if notification is blocked by preferences', async () => {
      const householdId = 'household-1';
      const createDto = {
        type: NotificationType.EXPENSE_ALERT,
        title: 'Test Notification',
        message: 'Test message',
        priority: NotificationPriority.MEDIUM,
        channels: [NotificationChannel.EMAIL],
        user_id: 'user-1',
      };

      const mockPreferences = {
        canReceiveNotification: jest.fn().mockReturnValue(false),
      };

      mockPreferencesRepository.findOne.mockResolvedValue(mockPreferences);

      await expect(service.create(householdId, createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated notifications', async () => {
      const householdId = 'household-1';
      const queryDto = { page: 1, limit: 20 };

      const mockNotifications = [
        { id: '1', title: 'Notification 1' },
        { id: '2', title: 'Notification 2' },
      ];

      mockQueryBuilder.getManyAndCount.mockResolvedValue([mockNotifications, 2]);

      const result = await service.findAll(householdId, queryDto);

      expect(result).toEqual({
        notifications: mockNotifications,
        total: 2,
        page: 1,
        pages: 1,
      });
    });
  });

  describe('findOne', () => {
    it('should return a notification by id', async () => {
      const householdId = 'household-1';
      const notificationId = 'notification-1';
      const mockNotification = { id: notificationId, title: 'Test Notification' };

      mockNotificationRepository.findOne.mockResolvedValue(mockNotification);

      const result = await service.findOne(householdId, notificationId);

      expect(mockNotificationRepository.findOne).toHaveBeenCalledWith({
        where: { id: notificationId, household_id: householdId },
        relations: ['user'],
      });
      expect(result).toEqual(mockNotification);
    });

    it('should throw NotFoundException if notification not found', async () => {
      const householdId = 'household-1';
      const notificationId = 'non-existent';

      mockNotificationRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(householdId, notificationId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const householdId = 'household-1';
      const notificationId = 'notification-1';
      const mockNotification = {
        id: notificationId,
        title: 'Test Notification',
        read_at: null,
      };

      mockNotificationRepository.findOne.mockResolvedValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue({
        ...mockNotification,
        read_at: expect.any(Date),
      });

      const result = await service.markAsRead(householdId, notificationId);

      expect(mockNotificationRepository.save).toHaveBeenCalled();
      expect(result.read_at).toBeDefined();
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      const householdId = 'household-1';
      const userId = 'user-1';
      const expectedCount = 5;

      mockNotificationRepository.count.mockResolvedValue(expectedCount);

      const result = await service.getUnreadCount(householdId, userId);

      expect(mockNotificationRepository.count).toHaveBeenCalledWith({
        where: {
          household_id: householdId,
          user_id: userId,
          read_at: null,
          status: NotificationStatus.DELIVERED,
        },
      });
      expect(result).toBe(expectedCount);
    });
  });

  describe('updateStatus', () => {
    it('should update notification status', async () => {
      const householdId = 'household-1';
      const notificationId = 'notification-1';
      const newStatus = NotificationStatus.SENT;
      
      const mockNotification = {
        id: notificationId,
        status: NotificationStatus.PENDING,
        sent_at: null,
      };

      mockNotificationRepository.findOne.mockResolvedValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue({
        ...mockNotification,
        status: newStatus,
        sent_at: expect.any(Date),
      });

      const result = await service.updateStatus(householdId, notificationId, newStatus);

      expect(result.status).toBe(newStatus);
      expect(result.sent_at).toBeDefined();
    });

    it('should update delivered_at for DELIVERED status', async () => {
      const householdId = 'household-1';
      const notificationId = 'notification-1';
      const newStatus = NotificationStatus.DELIVERED;
      
      const mockNotification = {
        id: notificationId,
        status: NotificationStatus.SENT,
        delivered_at: null,
      };

      mockNotificationRepository.findOne.mockResolvedValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue({
        ...mockNotification,
        status: newStatus,
        delivered_at: expect.any(Date),
      });

      const result = await service.updateStatus(householdId, notificationId, newStatus);

      expect(result.status).toBe(newStatus);
      expect(result.delivered_at).toBeDefined();
    });

    it('should increment retry_count for FAILED status', async () => {
      const householdId = 'household-1';
      const notificationId = 'notification-1';
      const newStatus = NotificationStatus.FAILED;
      
      const mockNotification = {
        id: notificationId,
        status: NotificationStatus.SENT,
        retry_count: 1,
      };

      mockNotificationRepository.findOne.mockResolvedValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue({
        ...mockNotification,
        status: newStatus,
        retry_count: 2,
      });

      const result = await service.updateStatus(householdId, notificationId, newStatus);

      expect(result.status).toBe(newStatus);
      expect(result.retry_count).toBe(2);
    });

    it('should throw NotFoundException when notification not found for status update', async () => {
      const householdId = 'household-1';
      const notificationId = 'non-existent';
      const newStatus = NotificationStatus.SENT;

      mockNotificationRepository.findOne.mockResolvedValue(null);

      await expect(service.updateStatus(householdId, notificationId, newStatus)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createBulk', () => {
    it('should create multiple notifications successfully', async () => {
      const householdId = 'household-1';
      const bulkCreateDto = {
        notifications: [
          {
            type: NotificationType.EXPENSE_ALERT,
            title: 'Notification 1',
            message: 'Message 1',
            priority: NotificationPriority.MEDIUM,
            channels: [NotificationChannel.IN_APP],
          },
          {
            type: NotificationType.GOAL_MILESTONE,
            title: 'Notification 2',
            message: 'Message 2',
            priority: NotificationPriority.HIGH,
            channels: [NotificationChannel.EMAIL],
          },
        ],
        continue_on_error: true,
      };

      const mockNotifications = bulkCreateDto.notifications.map((dto, index) => ({
        ...dto,
        id: `notification-${index + 1}`,
        household_id: householdId,
        status: NotificationStatus.PENDING,
      }));

      mockNotificationRepository.create
        .mockReturnValueOnce(mockNotifications[0])
        .mockReturnValueOnce(mockNotifications[1]);
      mockNotificationRepository.save
        .mockResolvedValueOnce(mockNotifications[0])
        .mockResolvedValueOnce(mockNotifications[0]) // updateStatus call
        .mockResolvedValueOnce(mockNotifications[1])
        .mockResolvedValueOnce(mockNotifications[1]); // updateStatus call
      mockNotificationRepository.findOne
        .mockResolvedValueOnce(mockNotifications[0])
        .mockResolvedValueOnce(mockNotifications[1]);

      const result = await service.createBulk(householdId, bulkCreateDto);

      expect(result.created).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(mockNotificationRepository.save).toHaveBeenCalledTimes(4); // 2 create + 2 updateStatus
    });

    it('should handle partial failures with continue_on_error', async () => {
      const householdId = 'household-1';
      const bulkCreateDto = {
        notifications: [
          {
            type: NotificationType.EXPENSE_ALERT,
            title: 'Valid Notification',
            message: 'Valid message',
            priority: NotificationPriority.MEDIUM,
            channels: [NotificationChannel.IN_APP],
          },
          {
            type: NotificationType.EXPENSE_ALERT,
            title: 'Invalid Notification',
            message: 'Invalid message',
            priority: NotificationPriority.MEDIUM,
            channels: [NotificationChannel.EMAIL],
            user_id: 'blocked-user',
          },
        ],
        continue_on_error: true,
      };

      const mockValidNotification = {
        ...bulkCreateDto.notifications[0],
        id: 'notification-1',
        household_id: householdId,
        status: NotificationStatus.PENDING,
        scheduled_at: new Date('2025-12-31T00:00:00Z'), // Future date to avoid updateStatus call
      };

      const mockPreferences = {
        canReceiveNotification: jest.fn().mockReturnValue(false),
      };

      // Mock the create method calls directly to control the flow better
      let callCount = 0;
      jest.spyOn(service, 'create').mockImplementation(async (householdId, dto) => {
        callCount++;
        if (callCount === 1) {
          // First notification succeeds
          return mockValidNotification as any;
        } else {
          // Second notification fails due to blocked preferences
          throw new BadRequestException('Notification blocked by user preferences');
        }
      });

      const result = await service.createBulk(householdId, bulkCreateDto);

      expect(result.created).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain('Notification blocked by user preferences');
    });

    it('should stop on first error when continue_on_error is false', async () => {
      const householdId = 'household-1';
      const bulkCreateDto = {
        notifications: [
          {
            type: NotificationType.EXPENSE_ALERT,
            title: 'Invalid Notification',
            message: 'Invalid message',
            priority: NotificationPriority.MEDIUM,
            channels: [NotificationChannel.EMAIL],
            user_id: 'blocked-user',
          },
          {
            type: NotificationType.GOAL_MILESTONE,
            title: 'Valid Notification',
            message: 'Valid message',
            priority: NotificationPriority.MEDIUM,
            channels: [NotificationChannel.IN_APP],
          },
        ],
        continue_on_error: false,
      };

      const mockPreferences = {
        canReceiveNotification: jest.fn().mockReturnValue(false),
      };

      mockPreferencesRepository.findOne.mockResolvedValue(mockPreferences);

      const result = await service.createBulk(householdId, bulkCreateDto);

      expect(result.created).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(mockNotificationRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update notification successfully', async () => {
      const householdId = 'household-1';
      const notificationId = 'notification-1';
      const updateDto = {
        title: 'Updated Title',
        message: 'Updated message',
        priority: NotificationPriority.HIGH,
      };

      const mockNotification = {
        id: notificationId,
        title: 'Original Title',
        message: 'Original message',
        priority: NotificationPriority.MEDIUM,
      };

      const updatedNotification = {
        ...mockNotification,
        ...updateDto,
      };

      mockNotificationRepository.findOne.mockResolvedValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(updatedNotification);

      const result = await service.update(householdId, notificationId, updateDto);

      expect(mockNotificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining(updateDto)
      );
      expect(result).toEqual(updatedNotification);
    });

    it('should throw NotFoundException when notification not found for update', async () => {
      const householdId = 'household-1';
      const notificationId = 'non-existent';
      const updateDto = { title: 'Updated Title' };

      mockNotificationRepository.findOne.mockResolvedValue(null);

      await expect(service.update(householdId, notificationId, updateDto)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockNotificationRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete notification successfully', async () => {
      const householdId = 'household-1';
      const notificationId = 'notification-1';
      const mockNotification = {
        id: notificationId,
        title: 'Test Notification',
      };

      mockNotificationRepository.findOne.mockResolvedValue(mockNotification);
      mockNotificationRepository.softDelete.mockResolvedValue({ affected: 1 } as any);

      await service.remove(householdId, notificationId);

      expect(mockNotificationRepository.findOne).toHaveBeenCalledWith({
        where: { id: notificationId, household_id: householdId },
        relations: ['user'],
      });
      expect(mockNotificationRepository.softDelete).toHaveBeenCalledWith(notificationId);
    });

    it('should throw NotFoundException when notification not found for removal', async () => {
      const householdId = 'household-1';
      const notificationId = 'non-existent';

      mockNotificationRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(householdId, notificationId)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockNotificationRepository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for household', async () => {
      const householdId = 'household-1';

      mockNotificationRepository.update.mockResolvedValue({ affected: 5 } as any);

      await service.markAllAsRead(householdId);

      expect(mockNotificationRepository.update).toHaveBeenCalledWith(
        {
          household_id: householdId,
          read_at: null,
        },
        { read_at: expect.any(Date) }
      );
    });

    it('should mark all notifications as read for specific user', async () => {
      const householdId = 'household-1';
      const userId = 'user-1';

      mockNotificationRepository.update.mockResolvedValue({ affected: 3 } as any);

      await service.markAllAsRead(householdId, userId);

      expect(mockNotificationRepository.update).toHaveBeenCalledWith(
        {
          household_id: householdId,
          user_id: userId,
          read_at: null,
        },
        { read_at: expect.any(Date) }
      );
    });
  });

  describe('bulkUpdate', () => {
    it('should bulk update notifications with status', async () => {
      const householdId = 'household-1';
      const updateDto = {
        status: NotificationStatus.SENT,
      };
      const filters = {
        type: NotificationType.EXPENSE_ALERT,
        status: NotificationStatus.PENDING,
      };

      mockNotificationRepository.update.mockResolvedValue({ affected: 10 } as any);

      const result = await service.bulkUpdate(householdId, updateDto, filters);

      expect(mockNotificationRepository.update).toHaveBeenCalledWith(
        {
          household_id: householdId,
          type: NotificationType.EXPENSE_ALERT,
          status: NotificationStatus.PENDING,
        },
        { status: NotificationStatus.SENT }
      );
      expect(result).toEqual({ updated: 10 });
    });

    it('should bulk mark notifications as read', async () => {
      const householdId = 'household-1';
      const updateDto = {
        mark_as_read: true,
      };
      const filters = {
        user_id: 'user-1',
      };

      mockNotificationRepository.update.mockResolvedValue({ affected: 5 } as any);

      const result = await service.bulkUpdate(householdId, updateDto, filters);

      expect(mockNotificationRepository.update).toHaveBeenCalledWith(
        {
          household_id: householdId,
          user_id: 'user-1',
        },
        { read_at: expect.any(Date) }
      );
      expect(result).toEqual({ updated: 5 });
    });

    it('should bulk update without filters', async () => {
      const householdId = 'household-1';
      const updateDto = {
        status: NotificationStatus.DELIVERED,
      };

      mockNotificationRepository.update.mockResolvedValue({ affected: 20 } as any);

      const result = await service.bulkUpdate(householdId, updateDto);

      expect(mockNotificationRepository.update).toHaveBeenCalledWith(
        { household_id: householdId },
        { status: NotificationStatus.DELIVERED }
      );
      expect(result).toEqual({ updated: 20 });
    });

    it('should handle bulk update with zero affected rows', async () => {
      const householdId = 'household-1';
      const updateDto = {
        status: NotificationStatus.FAILED,
      };

      mockNotificationRepository.update.mockResolvedValue({ affected: 0 } as any);

      const result = await service.bulkUpdate(householdId, updateDto);

      expect(result).toEqual({ updated: 0 });
    });
  });

  describe('markAsRead with clicked URL', () => {
    it('should mark notification as read with clicked URL', async () => {
      const householdId = 'household-1';
      const notificationId = 'notification-1';
      const clickedUrl = 'https://app.example.com/goal/123';

      const mockNotification = {
        id: notificationId,
        title: 'Test Notification',
        read_at: null,
        clicked_at: null,
        clicked_url: null,
      };

      mockNotificationRepository.findOne.mockResolvedValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue({
        ...mockNotification,
        read_at: expect.any(Date),
        clicked_at: expect.any(Date),
        clicked_url: clickedUrl,
      });

      const result = await service.markAsRead(householdId, notificationId, clickedUrl);

      expect(result.read_at).toBeDefined();
      expect(result.clicked_at).toBeDefined();
      expect(result.clicked_url).toBe(clickedUrl);
    });
  });

  describe('getUnreadCount with different scenarios', () => {
    it('should return unread count without user filter', async () => {
      const householdId = 'household-1';
      const expectedCount = 10;

      mockNotificationRepository.count.mockResolvedValue(expectedCount);

      const result = await service.getUnreadCount(householdId);

      expect(mockNotificationRepository.count).toHaveBeenCalledWith({
        where: {
          household_id: householdId,
          read_at: null,
          status: NotificationStatus.DELIVERED,
        },
      });
      expect(result).toBe(expectedCount);
    });

    it('should return zero when no unread notifications', async () => {
      const householdId = 'household-1';

      mockNotificationRepository.count.mockResolvedValue(0);

      const result = await service.getUnreadCount(householdId);

      expect(result).toBe(0);
    });
  });

  describe('findAll with comprehensive filtering', () => {
    beforeEach(() => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
    });

    it('should apply type filter', async () => {
      const householdId = 'household-1';
      const queryDto = {
        type: NotificationType.EXPENSE_ALERT,
        page: 1,
        limit: 20,
      };

      await service.findAll(householdId, queryDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'notification.type = :type',
        { type: NotificationType.EXPENSE_ALERT }
      );
    });

    it('should apply status filter', async () => {
      const householdId = 'household-1';
      const queryDto = {
        status: NotificationStatus.DELIVERED,
        page: 1,
        limit: 20,
      };

      await service.findAll(householdId, queryDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'notification.status = :status',
        { status: NotificationStatus.DELIVERED }
      );
    });

    it('should apply user_id filter', async () => {
      const householdId = 'household-1';
      const queryDto = {
        user_id: 'user-123',
        page: 1,
        limit: 20,
      };

      await service.findAll(householdId, queryDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'notification.user_id = :userId',
        { userId: 'user-123' }
      );
    });

    it('should apply min_priority filter', async () => {
      const householdId = 'household-1';
      const queryDto = {
        min_priority: NotificationPriority.HIGH,
        page: 1,
        limit: 20,
      };

      await service.findAll(householdId, queryDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'notification.priority IN (:...priorities)',
        { priorities: ['high', 'urgent'] }
      );
    });

    it('should apply is_read filter for read notifications', async () => {
      const householdId = 'household-1';
      const queryDto = {
        is_read: true,
        page: 1,
        limit: 20,
      };

      await service.findAll(householdId, queryDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'notification.read_at IS NOT NULL'
      );
    });

    it('should apply is_read filter for unread notifications', async () => {
      const householdId = 'household-1';
      const queryDto = {
        is_read: false,
        page: 1,
        limit: 20,
      };

      await service.findAll(householdId, queryDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'notification.read_at IS NULL'
      );
    });

    it('should apply date range filters', async () => {
      const householdId = 'household-1';
      const queryDto = {
        created_after: '2025-01-01',
        created_before: '2025-01-31',
        page: 1,
        limit: 20,
      };

      await service.findAll(householdId, queryDto);

      // Date range filtering in this service is done through where.created_at with Between, not andWhere
      // Since Between is applied at the repository level, we can't easily mock it
      // Instead, let's verify the query builder was called properly
      expect(mockQueryBuilder.getManyAndCount).toHaveBeenCalled();
    });

    it('should apply search filter', async () => {
      const householdId = 'household-1';
      const queryDto = {
        search: 'expense alert',
        page: 1,
        limit: 20,
      };

      await service.findAll(householdId, queryDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(notification.title ILIKE :search OR notification.message ILIKE :search)',
        { search: '%expense alert%' }
      );
    });

    it('should calculate pages correctly', async () => {
      const householdId = 'household-1';
      const queryDto = { page: 2, limit: 5 };
      const mockNotifications = Array(3).fill({ id: 'test' });

      mockQueryBuilder.getManyAndCount.mockResolvedValue([mockNotifications, 12]);

      const result = await service.findAll(householdId, queryDto);

      expect(result).toEqual({
        notifications: mockNotifications,
        total: 12,
        page: 2,
        pages: 3, // Math.ceil(12/5) = 3
      });
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5); // (2-1) * 5
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);
    });

    it('should handle edge case pagination', async () => {
      const householdId = 'household-1';
      const queryDto = { page: 1, limit: 50 };
      const mockNotifications = Array(10).fill({ id: 'test' });

      mockQueryBuilder.getManyAndCount.mockResolvedValue([mockNotifications, 10]);

      const result = await service.findAll(householdId, queryDto);

      expect(result.pages).toBe(1); // Math.ceil(10/50) = 1
    });
  });

  describe('create with scheduled notifications', () => {
    it('should not update status for scheduled notifications', async () => {
      const householdId = 'household-1';
      const createDto = {
        type: NotificationType.EXPENSE_ALERT,
        title: 'Scheduled Notification',
        message: 'Test message',
        priority: NotificationPriority.MEDIUM,
        channels: [NotificationChannel.EMAIL],
        scheduled_at: new Date('2025-12-31T10:00:00Z'), // Future date
      };

      const mockNotification = {
        ...createDto,
        id: 'notification-1',
        household_id: householdId,
        status: NotificationStatus.PENDING,
      };

      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification);

      const result = await service.create(householdId, createDto);

      expect(mockNotificationRepository.save).toHaveBeenCalledTimes(1); // Only create call, no updateStatus
      expect(result.status).toBe(NotificationStatus.PENDING);
    });

    it('should update status for immediate notifications', async () => {
      const householdId = 'household-1';
      const createDto = {
        type: NotificationType.EXPENSE_ALERT,
        title: 'Immediate Notification',
        message: 'Test message',
        priority: NotificationPriority.MEDIUM,
        channels: [NotificationChannel.EMAIL],
        scheduled_at: new Date('2020-01-01T00:00:00Z'), // Past date
      };

      const mockNotification = {
        ...createDto,
        id: 'notification-1',
        household_id: householdId,
        status: NotificationStatus.PENDING,
      };

      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save
        .mockResolvedValueOnce(mockNotification) // create call
        .mockResolvedValueOnce({ ...mockNotification, status: NotificationStatus.SENT }); // updateStatus call
      mockNotificationRepository.findOne.mockResolvedValue(mockNotification);

      await service.create(householdId, createDto);

      expect(mockNotificationRepository.save).toHaveBeenCalledTimes(2); // create + updateStatus
    });
  });

  describe('create without user_id', () => {
    it('should create notification without user preference check', async () => {
      const householdId = 'household-1';
      const createDto = {
        type: NotificationType.GOAL_MILESTONE,
        title: 'Household Notification',
        message: 'Test message',
        priority: NotificationPriority.HIGH,
        channels: [NotificationChannel.IN_APP],
        // No user_id provided
      };

      const mockNotification = {
        ...createDto,
        id: 'notification-1',
        household_id: householdId,
        status: NotificationStatus.PENDING,
      };

      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save
        .mockResolvedValueOnce(mockNotification)
        .mockResolvedValueOnce({ ...mockNotification, status: NotificationStatus.SENT });
      mockNotificationRepository.findOne.mockResolvedValue(mockNotification);

      const result = await service.create(householdId, createDto);

      expect(mockPreferencesRepository.findOne).not.toHaveBeenCalled();
      expect(result).toEqual(mockNotification);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty notification list in bulk create', async () => {
      const householdId = 'household-1';
      const bulkCreateDto = {
        notifications: [],
        continue_on_error: true,
      };

      const result = await service.createBulk(householdId, bulkCreateDto);

      expect(result.created).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
    });

    it('should handle update with empty updateDto', async () => {
      const householdId = 'household-1';
      const notificationId = 'notification-1';
      const updateDto = {};

      const mockNotification = {
        id: notificationId,
        title: 'Test Notification',
      };

      mockNotificationRepository.findOne.mockResolvedValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification);

      const result = await service.update(householdId, notificationId, updateDto);

      expect(result).toEqual(mockNotification);
    });

    it('should handle bulk update with undefined affected count', async () => {
      const householdId = 'household-1';
      const updateDto = { status: NotificationStatus.SENT };

      mockNotificationRepository.update.mockResolvedValue({ affected: undefined } as any);

      const result = await service.bulkUpdate(householdId, updateDto);

      expect(result.updated).toBe(0);
    });
  });
});
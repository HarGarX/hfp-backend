import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from '../services/notifications.service';
import {
  CreateNotificationDto,
  BulkCreateNotificationDto,
} from '../dto/create-notification.dto';
import {
  UpdateNotificationDto,
  MarkNotificationReadDto,
  BulkUpdateNotificationsDto,
} from '../dto/update-notification.dto';
import { QueryNotificationsDto } from '../dto/query-notifications.dto';
import { 
  NotificationStatus, 
  NotificationPriority,
  NotificationType,
  NotificationChannel,
} from '../entities/notification.entity';
import { UserRole } from '../../users/entities/user.entity';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: jest.Mocked<NotificationsService>;

  const mockHouseholdId = 'household-123';
  const mockUserId = 'user-123';

  const mockRequest = {
    user: {
      id: mockUserId,
      household_id: mockHouseholdId,
      role: UserRole.HOUSEHOLD_ADMIN,
    },
  };

  const mockNotification = {
    id: 'notification-123',
    title: 'Budget Alert',
    message: 'Your dining budget is 80% spent',
    status: NotificationStatus.SENT,
    priority: NotificationPriority.HIGH,
    type: NotificationType.BUDGET_EXCEEDED,
    household_id: mockHouseholdId,
    user_id: mockUserId,
    data: {
      category: 'dining',
      amount_spent: 800,
      budget_limit: 1000,
    },
    created_at: new Date(),
    updated_at: new Date(),
    read_at: null,
    clicked_url: null,
  };

  const mockNotificationsList = {
    notifications: [mockNotification],
    total: 1,
    page: 1,
    limit: 20,
    total_pages: 1,
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      getUnreadCount: jest.fn(),
      markAsRead: jest.fn(),
      remove: jest.fn(),
      bulkCreate: jest.fn(),
      bulkUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateNotificationDto = {
      title: 'New Goal Alert',
      message: 'Congratulations on reaching your savings goal!',
      type: NotificationType.GOAL_MILESTONE,
      priority: NotificationPriority.HIGH,
      user_id: mockUserId,
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      metadata: {
        entity_type: 'goal',
        entity_id: 'goal-123',
        custom_data: { amount_saved: 5000 },
      },
    };

    it('should create a notification successfully', async () => {
      service.create.mockResolvedValue(mockNotification as any);

      const result = await controller.create(mockRequest, createDto);

      expect(service.create).toHaveBeenCalledWith(mockHouseholdId, createDto);
      expect(result).toEqual(mockNotification);
    });

    it('should handle BadRequestException for invalid data', async () => {
      service.create.mockRejectedValue(new BadRequestException('Invalid notification data'));

      await expect(controller.create(mockRequest, createDto)).rejects.toThrow(BadRequestException);
    });

    it('should handle service errors during creation', async () => {
      service.create.mockRejectedValue(new Error('Database connection failed'));

      await expect(controller.create(mockRequest, createDto)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('findAll', () => {
    const queryDto: QueryNotificationsDto = {
      page: 1,
      limit: 20,
      status: NotificationStatus.SENT,
      min_priority: NotificationPriority.HIGH,
      type: NotificationType.BUDGET_EXCEEDED,
    };

    it('should return paginated notifications with filters', async () => {
      service.findAll.mockResolvedValue(mockNotificationsList as any);

      const result = await controller.findAll(mockRequest, queryDto);

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, queryDto);
      expect(result).toEqual(mockNotificationsList);
    });

    it('should return notifications without filters', async () => {
      const emptyQuery = {};
      service.findAll.mockResolvedValue(mockNotificationsList as any);

      const result = await controller.findAll(mockRequest, emptyQuery);

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, emptyQuery);
      expect(result).toEqual(mockNotificationsList);
    });

    it('should handle empty results gracefully', async () => {
      const emptyResponse = {
        notifications: [],
        total: 0,
        page: 1,
        limit: 20,
        total_pages: 0,
      };
      service.findAll.mockResolvedValue(emptyResponse as any);

      const result = await controller.findAll(mockRequest, queryDto);

      expect(result).toEqual(emptyResponse);
    });

    it('should handle service errors during retrieval', async () => {
      service.findAll.mockRejectedValue(new Error('Query execution failed'));

      await expect(controller.findAll(mockRequest, queryDto)).rejects.toThrow(
        'Query execution failed',
      );
    });
  });

  describe('findMy', () => {
    const queryDto: QueryNotificationsDto = {
      page: 1,
      limit: 20,
      status: NotificationStatus.SENT,
    };

    it('should return user-specific notifications', async () => {
      service.findAll.mockResolvedValue(mockNotificationsList as any);

      const result = await controller.findMy(mockRequest, queryDto);

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, {
        ...queryDto,
        user_id: mockUserId,
      });
      expect(result).toEqual(mockNotificationsList);
    });

    it('should handle empty query parameters', async () => {
      const emptyQuery = {};
      service.findAll.mockResolvedValue(mockNotificationsList as any);

      const result = await controller.findMy(mockRequest, emptyQuery);

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, {
        user_id: mockUserId,
      });
      expect(result).toEqual(mockNotificationsList);
    });

    it('should override user_id in query with current user', async () => {
      const queryWithDifferentUser = { ...queryDto, user_id: 'other-user-id' };
      service.findAll.mockResolvedValue(mockNotificationsList as any);

      const result = await controller.findMy(mockRequest, queryWithDifferentUser);

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, {
        ...queryWithDifferentUser,
        user_id: mockUserId,
      });
      expect(result).toEqual(mockNotificationsList);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      service.getUnreadCount.mockResolvedValue(5);

      const result = await controller.getUnreadCount(mockRequest);

      expect(service.getUnreadCount).toHaveBeenCalledWith(mockHouseholdId, mockUserId);
      expect(result).toEqual({ count: 5 });
    });

    it('should return zero count when no unread notifications', async () => {
      service.getUnreadCount.mockResolvedValue(0);

      const result = await controller.getUnreadCount(mockRequest);

      expect(service.getUnreadCount).toHaveBeenCalledWith(mockHouseholdId, mockUserId);
      expect(result).toEqual({ count: 0 });
    });

    it('should handle service errors during count retrieval', async () => {
      service.getUnreadCount.mockRejectedValue(new Error('Count query failed'));

      await expect(controller.getUnreadCount(mockRequest)).rejects.toThrow(
        'Count query failed',
      );
    });
  });

  describe('findOne', () => {
    const notificationId = 'notification-123';

    it('should return a specific notification', async () => {
      service.findOne.mockResolvedValue(mockNotification as any);

      const result = await controller.findOne(mockRequest, notificationId);

      expect(service.findOne).toHaveBeenCalledWith(mockHouseholdId, notificationId);
      expect(result).toEqual(mockNotification);
    });

    it('should handle NotFoundException for invalid id', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Notification not found'));

      await expect(controller.findOne(mockRequest, 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle ForbiddenException for unauthorized access', async () => {
      service.findOne.mockRejectedValue(
        new ForbiddenException('Access denied to notification'),
      );

      await expect(controller.findOne(mockRequest, notificationId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('markAsRead', () => {
    const notificationId = 'notification-123';
    const markReadDto: MarkNotificationReadDto = {
      clicked_url: 'https://app.hfp.com/goals/goal-123',
    };

    it('should mark notification as read successfully', async () => {
      const readNotification = {
        ...mockNotification,
        status: NotificationStatus.READ,
        read_at: new Date(),
        clicked_url: markReadDto.clicked_url,
      };
      service.markAsRead.mockResolvedValue(readNotification as any);

      const result = await controller.markAsRead(mockRequest, notificationId, markReadDto);

      expect(service.markAsRead).toHaveBeenCalledWith(
        mockHouseholdId,
        notificationId,
        markReadDto.clicked_url,
      );
      expect(result).toEqual(readNotification);
    });

    it('should mark as read without clicked url', async () => {
      const markReadWithoutUrl = { clicked_url: undefined };
      const readNotification = {
        ...mockNotification,
        status: NotificationStatus.READ,
        read_at: new Date(),
      };
      service.markAsRead.mockResolvedValue(readNotification as any);

      const result = await controller.markAsRead(
        mockRequest,
        notificationId,
        markReadWithoutUrl,
      );

      expect(service.markAsRead).toHaveBeenCalledWith(
        mockHouseholdId,
        notificationId,
        undefined,
      );
      expect(result).toEqual(readNotification);
    });

    it('should handle NotFoundException for invalid notification', async () => {
      service.markAsRead.mockRejectedValue(new NotFoundException('Notification not found'));

      await expect(
        controller.markAsRead(mockRequest, 'invalid-id', markReadDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle already read notifications gracefully', async () => {
      const alreadyReadNotification = {
        ...mockNotification,
        status: NotificationStatus.READ,
        read_at: new Date(),
      };
      service.markAsRead.mockResolvedValue(alreadyReadNotification as any);

      const result = await controller.markAsRead(mockRequest, notificationId, markReadDto);

      expect(result).toEqual(alreadyReadNotification);
    });
  });

  describe('remove', () => {
    const notificationId = 'notification-123';

    it('should delete notification successfully', async () => {
      service.remove.mockResolvedValue();

      const result = await controller.remove(mockRequest, notificationId);

      expect(service.remove).toHaveBeenCalledWith(mockHouseholdId, notificationId);
      expect(result).toEqual({ message: 'Notification deleted successfully' });
    });

    it('should handle NotFoundException for invalid id', async () => {
      service.remove.mockRejectedValue(new NotFoundException('Notification not found'));

      await expect(controller.remove(mockRequest, 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle ForbiddenException for unauthorized deletion', async () => {
      service.remove.mockRejectedValue(
        new ForbiddenException('Only admins can delete notifications'),
      );

      await expect(controller.remove(mockRequest, notificationId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should handle service errors during deletion', async () => {
      service.remove.mockRejectedValue(new Error('Database deletion failed'));

      await expect(controller.remove(mockRequest, notificationId)).rejects.toThrow(
        'Database deletion failed',
      );
    });
  });
});
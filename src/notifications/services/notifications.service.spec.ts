import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../services/notifications.service';
import { Notification, NotificationStatus, NotificationPriority, NotificationChannel, NotificationType } from '../entities/notification.entity';
import { NotificationPreferences } from '../entities/notification-preferences.entity';

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
  });
});
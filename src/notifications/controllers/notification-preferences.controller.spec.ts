import { Test, TestingModule } from '@nestjs/testing';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationPreferencesService } from '../services/notification-preferences.service';
import {
  CreateNotificationPreferencesDto,
  UpdateNotificationPreferencesDto,
  QuickPreferencesDto,
} from '../dto/notification-preferences.dto';
import {
  NotificationType,
  NotificationChannel,
} from '../entities/notification.entity';
import { UserRole } from '../../users/entities/user.entity';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('NotificationPreferencesController', () => {
  let controller: NotificationPreferencesController;
  let service: jest.Mocked<NotificationPreferencesService>;

  const mockHouseholdId = 'household-123';
  const mockUserId = 'user-123';

  const mockRequest = {
    user: {
      id: mockUserId,
      household_id: mockHouseholdId,
      role: UserRole.MEMBER,
    },
  };

  const mockPreferences = {
    id: 'preferences-123',
    user_id: mockUserId,
    household_id: mockHouseholdId,
    type_preferences: {
      [NotificationType.BUDGET_EXCEEDED]: {
        enabled: true,
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
        quiet_hours: { start: '22:00', end: '08:00' },
      },
      [NotificationType.GOAL_MILESTONE]: {
        enabled: true,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      },
    },
    channel_preferences: {
      [NotificationChannel.EMAIL]: {
        enabled: true,
        address: 'user@example.com',
        verified: true,
        frequency: 'immediate',
      },
      [NotificationChannel.IN_APP]: {
        enabled: true,
      },
      [NotificationChannel.PUSH]: {
        enabled: false,
      },
      [NotificationChannel.SMS]: {
        enabled: false,
      },
    },
    digest_settings: {
      weekly_digest: true,
      monthly_report: true,
      digest_time: '09:00',
      digest_day: 'monday',
    },
    global_settings: {
      do_not_disturb: false,
      quiet_hours_enabled: true,
      time_zone: 'America/New_York',
    },
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockStats = {
    total_users: 5,
    email_enabled: 4,
    push_enabled: 2,
    sms_enabled: 1,
    quiet_hours_enabled: 3,
    most_popular_types: [
      { type: NotificationType.BUDGET_EXCEEDED, count: 5 },
      { type: NotificationType.GOAL_MILESTONE, count: 4 },
    ],
    channel_usage: {
      [NotificationChannel.EMAIL]: 80,
      [NotificationChannel.IN_APP]: 100,
      [NotificationChannel.PUSH]: 40,
      [NotificationChannel.SMS]: 20,
    },
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findOrCreate: jest.fn(),
      getAllPreferences: jest.fn(),
      getPreferencesStats: jest.fn(),
      getDigestPreferences: jest.fn(),
      getTypeSettings: jest.fn(),
      getChannelSettings: jest.fn(),
      update: jest.fn(),
      updateQuick: jest.fn(),
      updateTypeSettings: jest.fn(),
      updateChannelSettings: jest.fn(),
      verifyChannel: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationPreferencesController],
      providers: [
        {
          provide: NotificationPreferencesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<NotificationPreferencesController>(NotificationPreferencesController);
    service = module.get(NotificationPreferencesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateNotificationPreferencesDto = {
      enabled: true,
      enabled_channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      digest_frequency: 'weekly' as any,
      digest_time: '09:00',
    };

    it('should create preferences successfully', async () => {
      service.create.mockResolvedValue(mockPreferences as any);

      const result = await controller.create(mockRequest, createDto);

      expect(service.create).toHaveBeenCalledWith(mockHouseholdId, mockUserId, createDto);
      expect(result).toEqual(mockPreferences);
    });

    it('should handle BadRequestException for invalid data', async () => {
      service.create.mockRejectedValue(new BadRequestException('Invalid email address'));

      await expect(controller.create(mockRequest, createDto)).rejects.toThrow(BadRequestException);
    });

    it('should handle service errors during creation', async () => {
      service.create.mockRejectedValue(new Error('Database connection failed'));

      await expect(controller.create(mockRequest, createDto)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('findMy', () => {
    it('should return user preferences', async () => {
      service.findOrCreate.mockResolvedValue(mockPreferences as any);

      const result = await controller.findMy(mockRequest);

      expect(service.findOrCreate).toHaveBeenCalledWith(mockHouseholdId, mockUserId);
      expect(result).toEqual(mockPreferences);
    });

    it('should create default preferences if none exist', async () => {
      const defaultPreferences = {
        ...mockPreferences,
        id: 'new-preferences',
        type_preferences: {},
        channel_preferences: {
          [NotificationChannel.IN_APP]: { enabled: true },
        },
      };
      service.findOrCreate.mockResolvedValue(defaultPreferences as any);

      const result = await controller.findMy(mockRequest);

      expect(result).toEqual(defaultPreferences);
    });

    it('should handle service errors during retrieval', async () => {
      service.findOrCreate.mockRejectedValue(new Error('Database query failed'));

      await expect(controller.findMy(mockRequest)).rejects.toThrow('Database query failed');
    });
  });

  describe('findAll', () => {
    it('should return all household preferences (admin only)', async () => {
      const adminRequest = { ...mockRequest, user: { ...mockRequest.user, role: UserRole.HOUSEHOLD_ADMIN } };
      const allPreferences = [mockPreferences];
      service.getAllPreferences.mockResolvedValue(allPreferences as any);

      const result = await controller.findAll(adminRequest);

      expect(service.getAllPreferences).toHaveBeenCalledWith(mockHouseholdId);
      expect(result).toEqual(allPreferences);
    });

    it('should handle empty household preferences', async () => {
      service.getAllPreferences.mockResolvedValue([] as any);

      const result = await controller.findAll(mockRequest);

      expect(result).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return preferences statistics', async () => {
      service.getPreferencesStats.mockResolvedValue(mockStats as any);

      const result = await controller.getStats(mockRequest);

      expect(service.getPreferencesStats).toHaveBeenCalledWith(mockHouseholdId);
      expect(result).toEqual(mockStats);
    });

    it('should handle stats for household with no users', async () => {
      const emptyStats = {
        total_users: 0,
        email_enabled: 0,
        push_enabled: 0,
        sms_enabled: 0,
        channel_usage: {},
      };
      service.getPreferencesStats.mockResolvedValue(emptyStats as any);

      const result = await controller.getStats(mockRequest);

      expect(result).toEqual(emptyStats);
    });
  });

  describe('getDigestPreferences', () => {
    it('should return digest preferences', async () => {
      const digestPrefs = {
        weekly_digest: true,
        monthly_report: true,
        digest_time: '09:00',
        digest_day: 'monday',
      };
      service.getDigestPreferences.mockResolvedValue(digestPrefs as any);

      const result = await controller.getDigestPreferences(mockRequest);

      expect(service.getDigestPreferences).toHaveBeenCalledWith(mockHouseholdId, mockUserId);
      expect(result).toEqual(digestPrefs);
    });

    it('should return default digest preferences if none set', async () => {
      const defaultDigest = {
        weekly_digest: false,
        monthly_report: false,
        digest_time: '08:00',
        digest_day: 'sunday',
      };
      service.getDigestPreferences.mockResolvedValue(defaultDigest as any);

      const result = await controller.getDigestPreferences(mockRequest);

      expect(result).toEqual(defaultDigest);
    });
  });

  describe('getTypeSettings', () => {
    it('should return settings for specific notification type', async () => {
      const typeSettings = {
        enabled: true,
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
        quiet_hours: { start: '22:00', end: '08:00' },
      };
      service.getTypeSettings.mockResolvedValue(typeSettings as any);

      const result = await controller.getTypeSettings(mockRequest, NotificationType.BUDGET_EXCEEDED);

      expect(service.getTypeSettings).toHaveBeenCalledWith(
        mockHouseholdId,
        mockUserId,
        NotificationType.BUDGET_EXCEEDED,
      );
      expect(result).toEqual(typeSettings);
    });

    it('should return default settings for unconfigured type', async () => {
      const defaultSettings = {
        enabled: false,
        channels: [],
      };
      service.getTypeSettings.mockResolvedValue(defaultSettings as any);

      const result = await controller.getTypeSettings(mockRequest, NotificationType.CUSTOM_ALERT);

      expect(result).toEqual(defaultSettings);
    });
  });

  describe('getChannelSettings', () => {
    it('should return settings for specific channel', async () => {
      const channelSettings = {
        enabled: true,
        address: 'user@example.com',
        verified: true,
        frequency: 'immediate',
      };
      service.getChannelSettings.mockResolvedValue(channelSettings as any);

      const result = await controller.getChannelSettings(mockRequest, NotificationChannel.EMAIL);

      expect(service.getChannelSettings).toHaveBeenCalledWith(
        mockHouseholdId,
        mockUserId,
        NotificationChannel.EMAIL,
      );
      expect(result).toEqual(channelSettings);
    });

    it('should return default settings for unconfigured channel', async () => {
      const defaultSettings = {
        enabled: false,
      };
      service.getChannelSettings.mockResolvedValue(defaultSettings as any);

      const result = await controller.getChannelSettings(mockRequest, NotificationChannel.SMS);

      expect(result).toEqual(defaultSettings);
    });
  });

  describe('update', () => {
    const updateDto: UpdateNotificationPreferencesDto = {
      enabled: true,
      digest_frequency: 'daily' as any,
    };

    it('should update preferences successfully', async () => {
      const updatedPreferences = { ...mockPreferences, ...updateDto };
      service.update.mockResolvedValue(updatedPreferences as any);

      const result = await controller.update(mockRequest, updateDto);

      expect(service.update).toHaveBeenCalledWith(mockHouseholdId, mockUserId, updateDto);
      expect(result).toEqual(updatedPreferences);
    });

    it('should handle BadRequestException for invalid settings', async () => {
      service.update.mockRejectedValue(new BadRequestException('Invalid time format'));

      await expect(controller.update(mockRequest, updateDto)).rejects.toThrow(BadRequestException);
    });

    it('should handle partial updates gracefully', async () => {
      const partialUpdate = {
        enabled: false,
      };
      const updatedPreferences = { ...mockPreferences, enabled: false };
      service.update.mockResolvedValue(updatedPreferences as any);

      const result = await controller.update(mockRequest, partialUpdate);

      expect(result).toEqual(updatedPreferences);
    });
  });

  describe('updateQuick', () => {
    const quickDto: QuickPreferencesDto = {
      enabled: true,
      email_enabled: true,
      push_enabled: false,
      sms_enabled: false,
    };

    it('should update quick preferences successfully', async () => {
      const updatedPreferences = { ...mockPreferences };
      service.updateQuick.mockResolvedValue(updatedPreferences as any);

      const result = await controller.updateQuick(mockRequest, quickDto);

      expect(service.updateQuick).toHaveBeenCalledWith(mockHouseholdId, mockUserId, quickDto);
      expect(result).toEqual(updatedPreferences);
    });

    it('should handle enabling all notifications', async () => {
      const enableAllDto = {
        enabled: true,
        email_enabled: true,
        push_enabled: true,
        sms_enabled: true,
      };
      service.updateQuick.mockResolvedValue(mockPreferences as any);

      const result = await controller.updateQuick(mockRequest, enableAllDto);

      expect(service.updateQuick).toHaveBeenCalledWith(mockHouseholdId, mockUserId, enableAllDto);
      expect(result).toEqual(mockPreferences);
    });

    it('should handle disabling all notifications', async () => {
      const disableAllDto = {
        enabled: false,
        email_enabled: false,
        push_enabled: false,
        sms_enabled: false,
      };
      service.updateQuick.mockResolvedValue(mockPreferences as any);

      const result = await controller.updateQuick(mockRequest, disableAllDto);

      expect(result).toEqual(mockPreferences);
    });
  });

  describe('updateTypeSettings', () => {
    const typeSettings = {
      enabled: false,
      channels: [NotificationChannel.EMAIL],
    };

    it('should update type-specific settings successfully', async () => {
      service.updateTypeSettings.mockResolvedValue(mockPreferences as any);

      const result = await controller.updateTypeSettings(
        mockRequest,
        NotificationType.BUDGET_EXCEEDED,
        typeSettings,
      );

      expect(service.updateTypeSettings).toHaveBeenCalledWith(
        mockHouseholdId,
        mockUserId,
        NotificationType.BUDGET_EXCEEDED,
        typeSettings,
      );
      expect(result).toEqual(mockPreferences);
    });

    it('should handle enabling new notification type', async () => {
      const newTypeSettings = {
        enabled: true,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      };
      service.updateTypeSettings.mockResolvedValue(mockPreferences as any);

      const result = await controller.updateTypeSettings(
        mockRequest,
        NotificationType.CUSTOM_ALERT,
        newTypeSettings,
      );

      expect(service.updateTypeSettings).toHaveBeenCalledWith(
        mockHouseholdId,
        mockUserId,
        NotificationType.CUSTOM_ALERT,
        newTypeSettings,
      );
    });
  });

  describe('updateChannelSettings', () => {
    const channelSettings = {
      enabled: true,
      phone: '+1234567890',
    };

    it('should update channel-specific settings successfully', async () => {
      service.updateChannelSettings.mockResolvedValue(mockPreferences as any);

      const result = await controller.updateChannelSettings(
        mockRequest,
        NotificationChannel.SMS,
        channelSettings,
      );

      expect(service.updateChannelSettings).toHaveBeenCalledWith(
        mockHouseholdId,
        mockUserId,
        NotificationChannel.SMS,
        channelSettings,
      );
      expect(result).toEqual(mockPreferences);
    });

    it('should handle email channel configuration', async () => {
      const emailSettings = {
        enabled: true,
        address: 'newemail@example.com',
        frequency: 'daily',
      };
      service.updateChannelSettings.mockResolvedValue(mockPreferences as any);

      const result = await controller.updateChannelSettings(
        mockRequest,
        NotificationChannel.EMAIL,
        emailSettings,
      );

      expect(service.updateChannelSettings).toHaveBeenCalledWith(
        mockHouseholdId,
        mockUserId,
        NotificationChannel.EMAIL,
        emailSettings,
      );
    });
  });

  describe('verifyChannel', () => {
    it('should verify channel successfully', async () => {
      service.verifyChannel.mockResolvedValue(true);

      const result = await controller.verifyChannel(
        mockRequest,
        NotificationChannel.EMAIL,
        { verification_code: '123456' },
      );

      expect(service.verifyChannel).toHaveBeenCalledWith(
        mockHouseholdId,
        mockUserId,
        NotificationChannel.EMAIL,
        '123456',
      );
      expect(result).toEqual({
        success: true,
        message: 'Channel verified successfully',
      });
    });

    it('should handle verification failure', async () => {
      service.verifyChannel.mockResolvedValue(false);

      const result = await controller.verifyChannel(
        mockRequest,
        NotificationChannel.SMS,
        { verification_code: 'invalid' },
      );

      expect(service.verifyChannel).toHaveBeenCalledWith(
        mockHouseholdId,
        mockUserId,
        NotificationChannel.SMS,
        'invalid',
      );
      expect(result).toEqual({
        success: false,
        message: 'Verification failed',
      });
    });

    it('should handle verification without code', async () => {
      service.verifyChannel.mockResolvedValue(false);

      const result = await controller.verifyChannel(
        mockRequest,
        NotificationChannel.EMAIL,
        {},
      );

      expect(service.verifyChannel).toHaveBeenCalledWith(
        mockHouseholdId,
        mockUserId,
        NotificationChannel.EMAIL,
        undefined,
      );
      expect(result.success).toBe(false);
    });

    it('should handle service errors during verification', async () => {
      service.verifyChannel.mockRejectedValue(new Error('Verification service unavailable'));

      await expect(
        controller.verifyChannel(mockRequest, NotificationChannel.EMAIL, { verification_code: '123456' }),
      ).rejects.toThrow('Verification service unavailable');
    });
  });

  describe('remove', () => {
    it('should reset preferences to defaults successfully', async () => {
      service.remove.mockResolvedValue();

      const result = await controller.remove(mockRequest);

      expect(service.remove).toHaveBeenCalledWith(mockHouseholdId, mockUserId);
      expect(result).toEqual({ message: 'Preferences reset to defaults' });
    });

    it('should handle service errors during removal', async () => {
      service.remove.mockRejectedValue(new Error('Database deletion failed'));

      await expect(controller.remove(mockRequest)).rejects.toThrow('Database deletion failed');
    });

    it('should handle removing non-existent preferences gracefully', async () => {
      service.remove.mockRejectedValue(new NotFoundException('Preferences not found'));

      await expect(controller.remove(mockRequest)).rejects.toThrow(NotFoundException);
    });
  });
});
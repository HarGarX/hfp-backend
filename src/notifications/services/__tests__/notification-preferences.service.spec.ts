import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { NotificationPreferencesService } from '../notification-preferences.service';
import { NotificationPreferences, DigestFrequency, QuietHoursMode } from '../../entities/notification-preferences.entity';
import { NotificationType, NotificationChannel, NotificationPriority } from '../../entities/notification.entity';
import {
  CreateNotificationPreferencesDto,
  UpdateNotificationPreferencesDto,
  QuickPreferencesDto,
} from '../../dto/notification-preferences.dto';

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService;
  let repository: jest.Mocked<Repository<NotificationPreferences>>;

  const mockHouseholdId = '123e4567-e89b-12d3-a456-426614174000';
  const mockUserId = '123e4567-e89b-12d3-a456-426614174001';

  const mockPreferences: NotificationPreferences = {
    id: '123e4567-e89b-12d3-a456-426614174002',
    household_id: mockHouseholdId,
    user_id: mockUserId,
    enabled: true,
    enabled_channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    digest_frequency: DigestFrequency.WEEKLY,
    digest_time: '09:00',
    digest_days: [1],
    minimum_priority: NotificationPriority.LOW,
    urgent_override_threshold: NotificationPriority.HIGH,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
    quiet_hours_mode: QuietHoursMode.ENABLED,
    type_settings: {
      [NotificationType.EXPENSE_ALERT]: {
        enabled: true,
        channels: [NotificationChannel.EMAIL],
        minimum_priority: NotificationPriority.MEDIUM,
        delay_minutes: 0,
      },
    },
    channel_settings: {
      [NotificationChannel.EMAIL]: {
        address: 'user@example.com',
        verified: true,
      },
    },
    timezone: 'America/New_York',
    should_send_digest_today: false,
    is_in_quiet_hours: false,
    effective_channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    user: null,
    canReceiveNotification: jest.fn(),
    getDelayMinutes: jest.fn(),
  } as any;

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPreferencesService,
        {
          provide: getRepositoryToken(NotificationPreferences),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<NotificationPreferencesService>(NotificationPreferencesService);
    repository = module.get(getRepositoryToken(NotificationPreferences));

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateNotificationPreferencesDto = {
      enabled: true,
      enabled_channels: [NotificationChannel.EMAIL],
      digest_frequency: DigestFrequency.DAILY,
    };

    it('should create new preferences successfully', async () => {
      repository.findOne.mockResolvedValue(null as any); // No existing preferences
      repository.create.mockReturnValue(mockPreferences as any);
      repository.save.mockResolvedValue(mockPreferences as any);

      const result = await service.create(mockHouseholdId, mockUserId, createDto);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { household_id: mockHouseholdId, user_id: mockUserId },
      });
      expect(repository.create).toHaveBeenCalledWith({
        ...createDto,
        household_id: mockHouseholdId,
        user_id: mockUserId,
      });
      expect(repository.save).toHaveBeenCalledWith(mockPreferences);
      expect(result).toEqual(mockPreferences);
    });

    it('should throw ConflictException when preferences already exist', async () => {
      repository.findOne.mockResolvedValue(mockPreferences as any);

      await expect(service.create(mockHouseholdId, mockUserId, createDto)).rejects.toThrow(
        new ConflictException('Notification preferences already exist for this user'),
      );

      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('findByUser', () => {
    it('should find preferences for user', async () => {
      repository.findOne.mockResolvedValue(mockPreferences as any);

      const result = await service.findByUser(mockHouseholdId, mockUserId);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { household_id: mockHouseholdId, user_id: mockUserId },
        relations: ['user'],
      });
      expect(result).toEqual(mockPreferences);
    });

    it('should return null when no preferences found', async () => {
      repository.findOne.mockResolvedValue(null as any);

      const result = await service.findByUser(mockHouseholdId, mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('findOrCreate', () => {
    it('should return existing preferences when found', async () => {
      repository.findOne.mockResolvedValue(mockPreferences as any);

      const result = await service.findOrCreate(mockHouseholdId, mockUserId);

      expect(result).toEqual(mockPreferences);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should create default preferences when not found', async () => {
      repository.findOne.mockResolvedValueOnce(null); // First call returns null
      repository.findOne.mockResolvedValueOnce(null); // Second call for create method
      repository.create.mockReturnValue(mockPreferences as any);
      repository.save.mockResolvedValue(mockPreferences as any);

      const result = await service.findOrCreate(mockHouseholdId, mockUserId);

      expect(repository.create).toHaveBeenCalledWith({
        enabled: true,
        enabled_channels: [NotificationChannel.IN_APP],
        digest_frequency: DigestFrequency.WEEKLY,
        quiet_hours_mode: QuietHoursMode.ENABLED,
        minimum_priority: NotificationPriority.LOW,
        urgent_override_threshold: NotificationPriority.HIGH,
        household_id: mockHouseholdId,
        user_id: mockUserId,
      });
      expect(result).toEqual(mockPreferences);
    });
  });

  describe('update', () => {
    const updateDto: UpdateNotificationPreferencesDto = {
      enabled: false,
      digest_frequency: DigestFrequency.DAILY,
    };

    it('should update preferences successfully', async () => {
      const updatedPreferences = { ...mockPreferences, ...updateDto };
      repository.findOne.mockResolvedValue(mockPreferences as any);
      repository.save.mockResolvedValue(updatedPreferences as any);

      const result = await service.update(mockHouseholdId, mockUserId, updateDto);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { household_id: mockHouseholdId, user_id: mockUserId },
        relations: ['user'],
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(updatedPreferences);
    });

    it('should throw NotFoundException when preferences not found', async () => {
      repository.findOne.mockResolvedValue(null as any);

      await expect(service.update(mockHouseholdId, mockUserId, updateDto)).rejects.toThrow(
        new NotFoundException('Notification preferences not found'),
      );

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('updateQuick', () => {
    const quickDto: QuickPreferencesDto = {
      enabled: true,
      email_enabled: true,
      sms_enabled: false,
      push_enabled: true,
      digest_frequency: DigestFrequency.DAILY,
    };

    it('should update quick preferences successfully', async () => {
      const preferencesWithChannels = {
        ...mockPreferences,
        enabled_channels: [NotificationChannel.IN_APP],
      };
      repository.findOne.mockResolvedValue(preferencesWithChannels as any);
      repository.save.mockResolvedValue(preferencesWithChannels as any);

      const result = await service.updateQuick(mockHouseholdId, mockUserId, quickDto);

      expect(repository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle enabling and disabling channels correctly', async () => {
      const preferencesWithLimitedChannels = {
        ...mockPreferences,
        enabled_channels: [NotificationChannel.IN_APP, NotificationChannel.SMS],
      };
      repository.findOne.mockResolvedValue(preferencesWithLimitedChannels as any);

      const savedPreferences = { ...preferencesWithLimitedChannels };
      repository.save.mockImplementation(async (prefs) => {
        savedPreferences.enabled_channels = prefs.enabled_channels as any;
        return savedPreferences as any;
      });

      const result = await service.updateQuick(mockHouseholdId, mockUserId, {
        email_enabled: true, // Should add EMAIL
        sms_enabled: false, // Should remove SMS
        push_enabled: true, // Should add PUSH
      });

      const savedChannels = savedPreferences.enabled_channels;
      expect(savedChannels).toContain(NotificationChannel.EMAIL);
      expect(savedChannels).toContain(NotificationChannel.PUSH);
      expect(savedChannels).toContain(NotificationChannel.IN_APP);
      expect(savedChannels).not.toContain(NotificationChannel.SMS);
    });

    it('should ensure IN_APP channel is always included when enabled', async () => {
      const preferencesWithoutInApp = {
        ...mockPreferences,
        enabled: true,
        enabled_channels: [NotificationChannel.EMAIL],
      };
      repository.findOne.mockResolvedValue(preferencesWithoutInApp as any);

      const savedPreferences = { ...preferencesWithoutInApp };
      repository.save.mockImplementation(async (prefs) => {
        savedPreferences.enabled_channels = prefs.enabled_channels as any;
        return savedPreferences as any;
      });

      await service.updateQuick(mockHouseholdId, mockUserId, { enabled: true });

      expect(savedPreferences.enabled_channels).toContain(NotificationChannel.IN_APP);
    });

    it('should create preferences if they do not exist', async () => {
      repository.findOne.mockResolvedValueOnce(null); // First call for findOrCreate
      repository.findOne.mockResolvedValueOnce(null); // Second call for create method
      repository.create.mockReturnValue(mockPreferences as any);
      repository.save.mockResolvedValue(mockPreferences as any);

      const result = await service.updateQuick(mockHouseholdId, mockUserId, quickDto);

      expect(repository.create).toHaveBeenCalled();
      expect(result).toEqual(mockPreferences);
    });
  });

  describe('remove', () => {
    it('should remove preferences successfully', async () => {
      repository.findOne.mockResolvedValue(mockPreferences as any);
      repository.softDelete.mockResolvedValue({ affected: 1 } as any);

      await service.remove(mockHouseholdId, mockUserId);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { household_id: mockHouseholdId, user_id: mockUserId },
        relations: ['user'],
      });
      expect(repository.softDelete).toHaveBeenCalledWith(mockPreferences.id);
    });

    it('should throw NotFoundException when preferences not found', async () => {
      repository.findOne.mockResolvedValue(null as any);

      await expect(service.remove(mockHouseholdId, mockUserId)).rejects.toThrow(
        new NotFoundException('Notification preferences not found'),
      );

      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('getTypeSettings', () => {
    it('should return type settings for existing configuration', async () => {
      repository.findOne.mockResolvedValue(mockPreferences as any);

      const result = await service.getTypeSettings(
        mockHouseholdId,
        mockUserId,
        NotificationType.EXPENSE_ALERT,
      );

      expect(result).toEqual({
        enabled: true,
        channels: [NotificationChannel.EMAIL],
        minimum_priority: NotificationPriority.MEDIUM,
        delay_minutes: 0,
      });
    });

    it('should return default settings for unconfigured type', async () => {
      repository.findOne.mockResolvedValue(mockPreferences as any);

      const result = await service.getTypeSettings(
        mockHouseholdId,
        mockUserId,
        NotificationType.GOAL_MILESTONE,
      );

      expect(result).toEqual({
        enabled: true,
        channels: mockPreferences.enabled_channels,
        minimum_priority: mockPreferences.minimum_priority,
        delay_minutes: 0,
      });
    });

    it('should create preferences if they do not exist', async () => {
      repository.findOne.mockResolvedValueOnce(null); // First call for findOrCreate
      repository.findOne.mockResolvedValueOnce(null); // Second call for create method
      repository.create.mockReturnValue(mockPreferences as any);
      repository.save.mockResolvedValue(mockPreferences as any);

      const result = await service.getTypeSettings(
        mockHouseholdId,
        mockUserId,
        NotificationType.EXPENSE_ALERT,
      );

      expect(repository.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('updateTypeSettings', () => {
    it('should update type settings successfully', async () => {
      const preferencesWithTypeSettings = {
        ...mockPreferences,
        type_settings: {
          [NotificationType.EXPENSE_ALERT]: {
            enabled: true,
            channels: [NotificationChannel.EMAIL],
          },
        },
      };
      repository.findOne.mockResolvedValue(preferencesWithTypeSettings as any);
      repository.save.mockResolvedValue(preferencesWithTypeSettings as any);

      const newSettings = {
        enabled: false,
        minimum_priority: NotificationPriority.HIGH,
      };

      const result = await service.updateTypeSettings(
        mockHouseholdId,
        mockUserId,
        NotificationType.EXPENSE_ALERT,
        newSettings,
      );

      expect(repository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should initialize type_settings if undefined', async () => {
      const preferencesWithoutTypeSettings = {
        ...mockPreferences,
        type_settings: undefined,
      };
      repository.findOne.mockResolvedValue(preferencesWithoutTypeSettings as any);

      const savedPreferences = { ...preferencesWithoutTypeSettings };
      repository.save.mockImplementation(async (prefs) => {
        savedPreferences.type_settings = prefs.type_settings as any;
        return savedPreferences as any;
      });

      await service.updateTypeSettings(
        mockHouseholdId,
        mockUserId,
        NotificationType.EXPENSE_ALERT,
        { enabled: true },
      );

      expect(savedPreferences.type_settings).toBeDefined();
      expect(savedPreferences.type_settings![NotificationType.EXPENSE_ALERT]).toBeDefined();
    });

    it('should create preferences if they do not exist', async () => {
      repository.findOne.mockResolvedValueOnce(null); // First call for findOrCreate
      repository.findOne.mockResolvedValueOnce(null); // Second call for create method
      repository.create.mockReturnValue(mockPreferences as any);
      repository.save.mockResolvedValue(mockPreferences as any);

      const result = await service.updateTypeSettings(
        mockHouseholdId,
        mockUserId,
        NotificationType.EXPENSE_ALERT,
        { enabled: true },
      );

      expect(repository.create).toHaveBeenCalled();
      expect(result).toEqual(mockPreferences);
    });
  });

  describe('getChannelSettings', () => {
    it('should return channel settings when they exist', async () => {
      repository.findOne.mockResolvedValue(mockPreferences as any);

      const result = await service.getChannelSettings(
        mockHouseholdId,
        mockUserId,
        NotificationChannel.EMAIL,
      );

      expect(result).toEqual({
        address: 'user@example.com',
        verified: true,
      });
    });

    it('should return empty object for unconfigured channel', async () => {
      repository.findOne.mockResolvedValue(mockPreferences as any);

      const result = await service.getChannelSettings(
        mockHouseholdId,
        mockUserId,
        NotificationChannel.SMS,
      );

      expect(result).toEqual({});
    });

    it('should create preferences if they do not exist', async () => {
      repository.findOne.mockResolvedValueOnce(null); // First call for findOrCreate
      repository.findOne.mockResolvedValueOnce(null); // Second call for create method
      repository.create.mockReturnValue(mockPreferences as any);
      repository.save.mockResolvedValue(mockPreferences as any);

      const result = await service.getChannelSettings(
        mockHouseholdId,
        mockUserId,
        NotificationChannel.EMAIL,
      );

      expect(repository.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('updateChannelSettings', () => {
    it('should update channel settings successfully', async () => {
      repository.findOne.mockResolvedValue(mockPreferences as any);
      repository.save.mockResolvedValue(mockPreferences as any);

      const newSettings = {
        address: 'new@example.com',
        verified: false,
      };

      const result = await service.updateChannelSettings(
        mockHouseholdId,
        mockUserId,
        NotificationChannel.EMAIL,
        newSettings,
      );

      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(mockPreferences);
    });

    it('should initialize channel_settings if undefined', async () => {
      const preferencesWithoutChannelSettings = {
        ...mockPreferences,
        channel_settings: undefined,
      };
      repository.findOne.mockResolvedValue(preferencesWithoutChannelSettings as any);

      const savedPreferences = { ...preferencesWithoutChannelSettings };
      repository.save.mockImplementation(async (prefs) => {
        savedPreferences.channel_settings = prefs.channel_settings as any;
        return savedPreferences as any;
      });

      await service.updateChannelSettings(
        mockHouseholdId,
        mockUserId,
        NotificationChannel.EMAIL,
        { address: 'test@example.com' },
      );

      expect(savedPreferences.channel_settings).toBeDefined();
      expect(savedPreferences.channel_settings![NotificationChannel.EMAIL]).toBeDefined();
    });

    it('should create preferences if they do not exist', async () => {
      repository.findOne.mockResolvedValueOnce(null); // First call for findOrCreate
      repository.findOne.mockResolvedValueOnce(null); // Second call for create method
      repository.create.mockReturnValue(mockPreferences as any);
      repository.save.mockResolvedValue(mockPreferences as any);

      const result = await service.updateChannelSettings(
        mockHouseholdId,
        mockUserId,
        NotificationChannel.EMAIL,
        { address: 'test@example.com' },
      );

      expect(repository.create).toHaveBeenCalled();
      expect(result).toEqual(mockPreferences);
    });
  });

  describe('verifyChannel', () => {
    it('should verify channel successfully', async () => {
      repository.findOne.mockResolvedValue(mockPreferences as any);
      repository.save.mockResolvedValue(mockPreferences as any);

      const result = await service.verifyChannel(
        mockHouseholdId,
        mockUserId,
        NotificationChannel.EMAIL,
        'verification-code',
      );

      expect(repository.save).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should verify channel without verification code', async () => {
      repository.findOne.mockResolvedValue(mockPreferences as any);
      repository.save.mockResolvedValue(mockPreferences as any);

      const result = await service.verifyChannel(
        mockHouseholdId,
        mockUserId,
        NotificationChannel.EMAIL,
      );

      expect(result).toBe(true);
    });

    it('should initialize channel settings for verification', async () => {
      const preferencesWithoutChannelSettings = {
        ...mockPreferences,
        channel_settings: undefined,
      };
      repository.findOne.mockResolvedValue(preferencesWithoutChannelSettings as any);

      const savedPreferences = { ...preferencesWithoutChannelSettings };
      repository.save.mockImplementation(async (prefs) => {
        savedPreferences.channel_settings = prefs.channel_settings as any;
        return savedPreferences as any;
      });

      const result = await service.verifyChannel(
        mockHouseholdId,
        mockUserId,
        NotificationChannel.EMAIL,
      );

      expect(savedPreferences.channel_settings).toBeDefined();
      expect((savedPreferences.channel_settings![NotificationChannel.EMAIL] as any).verified).toBe(true);
      expect(result).toBe(true);
    });

    it('should create preferences if they do not exist', async () => {
      repository.findOne.mockResolvedValueOnce(null); // First call for findOrCreate
      repository.findOne.mockResolvedValueOnce(null); // Second call for create method
      repository.create.mockReturnValue(mockPreferences as any);
      repository.save.mockResolvedValue(mockPreferences as any);

      const result = await service.verifyChannel(
        mockHouseholdId,
        mockUserId,
        NotificationChannel.EMAIL,
      );

      expect(repository.create).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('getDigestPreferences', () => {
    it('should return digest preferences with defaults', async () => {
      repository.findOne.mockResolvedValue(mockPreferences as any);

      const result = await service.getDigestPreferences(mockHouseholdId, mockUserId);

      expect(result).toEqual({
        frequency: mockPreferences.digest_frequency,
        time: mockPreferences.digest_time,
        days: mockPreferences.digest_days,
        should_send_today: mockPreferences.should_send_digest_today,
      });
    });

    it('should return default values when preferences have nulls', async () => {
      const preferencesWithNulls = {
        ...mockPreferences,
        digest_time: null,
        digest_days: null,
      };
      repository.findOne.mockResolvedValue(preferencesWithNulls as any);

      const result = await service.getDigestPreferences(mockHouseholdId, mockUserId);

      expect(result.time).toBe('09:00');
      expect(result.days).toEqual([1]);
    });

    it('should create preferences if they do not exist', async () => {
      repository.findOne.mockResolvedValueOnce(null); // First call for findOrCreate
      repository.findOne.mockResolvedValueOnce(null); // Second call for create method
      repository.create.mockReturnValue(mockPreferences as any);
      repository.save.mockResolvedValue(mockPreferences as any);

      const result = await service.getDigestPreferences(mockHouseholdId, mockUserId);

      expect(repository.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('getUsersForDigest', () => {
    it('should find users for digest frequency', async () => {
      const digestUsers = [mockPreferences];
      repository.find.mockResolvedValue(digestUsers as any);

      const result = await service.getUsersForDigest(mockHouseholdId, DigestFrequency.WEEKLY);

      expect(repository.find).toHaveBeenCalledWith({
        where: {
          household_id: mockHouseholdId,
          enabled: true,
          digest_frequency: DigestFrequency.WEEKLY,
        },
        relations: ['user'],
      });
      expect(result).toEqual(digestUsers);
    });

    it('should return empty array when no users found', async () => {
      repository.find.mockResolvedValue([] as any);

      const result = await service.getUsersForDigest(mockHouseholdId, DigestFrequency.DAILY);

      expect(result).toEqual([]);
    });
  });

  describe('isInQuietHours', () => {
    it('should return quiet hours status', async () => {
      repository.findOne.mockResolvedValue(mockPreferences as any);

      const result = await service.isInQuietHours(mockHouseholdId, mockUserId);

      expect(result).toBe(mockPreferences.is_in_quiet_hours);
    });

    it('should create preferences if they do not exist', async () => {
      repository.findOne.mockResolvedValueOnce(null); // First call for findOrCreate
      repository.findOne.mockResolvedValueOnce(null); // Second call for create method
      repository.create.mockReturnValue(mockPreferences as any);
      repository.save.mockResolvedValue(mockPreferences as any);

      const result = await service.isInQuietHours(mockHouseholdId, mockUserId);

      expect(repository.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('canReceiveNotification', () => {
    it('should check notification permission through entity method', async () => {
      mockPreferences.canReceiveNotification = jest.fn().mockReturnValue(true);
      repository.findOne.mockResolvedValue(mockPreferences as any);

      const result = await service.canReceiveNotification(
        mockHouseholdId,
        mockUserId,
        NotificationType.EXPENSE_ALERT,
        NotificationPriority.MEDIUM,
        NotificationChannel.EMAIL,
      );

      expect(mockPreferences.canReceiveNotification).toHaveBeenCalledWith(
        NotificationType.EXPENSE_ALERT,
        NotificationPriority.MEDIUM,
        NotificationChannel.EMAIL,
      );
      expect(result).toBe(true);
    });

    it('should create preferences if they do not exist', async () => {
      repository.findOne.mockResolvedValueOnce(null); // First call for findOrCreate
      repository.findOne.mockResolvedValueOnce(null); // Second call for create method
      const newPreferences = { ...mockPreferences, canReceiveNotification: jest.fn().mockReturnValue(false) };
      repository.create.mockReturnValue(newPreferences as any);
      repository.save.mockResolvedValue(newPreferences as any);

      const result = await service.canReceiveNotification(
        mockHouseholdId,
        mockUserId,
        NotificationType.EXPENSE_ALERT,
        NotificationPriority.MEDIUM,
        NotificationChannel.EMAIL,
      );

      expect(repository.create).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('getEffectiveChannels', () => {
    it('should return effective channels', async () => {
      repository.findOne.mockResolvedValue(mockPreferences as any);

      const result = await service.getEffectiveChannels(mockHouseholdId, mockUserId);

      expect(result).toEqual(mockPreferences.effective_channels);
    });

    it('should create preferences if they do not exist', async () => {
      repository.findOne.mockResolvedValueOnce(null); // First call for findOrCreate
      repository.findOne.mockResolvedValueOnce(null); // Second call for create method
      repository.create.mockReturnValue(mockPreferences as any);
      repository.save.mockResolvedValue(mockPreferences as any);

      const result = await service.getEffectiveChannels(mockHouseholdId, mockUserId);

      expect(repository.create).toHaveBeenCalled();
      expect(result).toEqual(mockPreferences.effective_channels);
    });
  });

  describe('getAllPreferences', () => {
    it('should return all household preferences', async () => {
      const allPreferences = [mockPreferences];
      repository.find.mockResolvedValue(allPreferences as any);

      const result = await service.getAllPreferences(mockHouseholdId);

      expect(repository.find).toHaveBeenCalledWith({
        where: { household_id: mockHouseholdId },
        relations: ['user'],
      });
      expect(result).toEqual(allPreferences);
    });

    it('should return empty array when no preferences found', async () => {
      repository.find.mockResolvedValue([] as any);

      const result = await service.getAllPreferences(mockHouseholdId);

      expect(result).toEqual([]);
    });
  });

  describe('getPreferencesStats', () => {
    it('should calculate preferences statistics correctly', async () => {
      const preferences = [
        {
          ...mockPreferences,
          enabled: true,
          enabled_channels: [NotificationChannel.EMAIL, NotificationChannel.SMS],
          digest_frequency: DigestFrequency.WEEKLY,
          quiet_hours_mode: QuietHoursMode.ENABLED,
        },
        {
          ...mockPreferences,
          id: 'other-id',
          user_id: 'other-user',
          enabled: false,
          enabled_channels: [NotificationChannel.IN_APP],
          digest_frequency: DigestFrequency.DAILY,
          quiet_hours_mode: QuietHoursMode.DISABLED,
        },
      ];
      repository.find.mockResolvedValue(preferences as any);

      const result = await service.getPreferencesStats(mockHouseholdId);

      expect(result).toEqual({
        total_users: 2,
        enabled_users: 1,
        by_channel: {
          [NotificationChannel.EMAIL]: 1,
          [NotificationChannel.SMS]: 1,
          [NotificationChannel.IN_APP]: 1,
        },
        by_digest_frequency: {
          [DigestFrequency.WEEKLY]: 1,
          [DigestFrequency.DAILY]: 1,
        },
        quiet_hours_enabled: 1,
      });
    });

    it('should handle empty preferences list', async () => {
      repository.find.mockResolvedValue([] as any);

      const result = await service.getPreferencesStats(mockHouseholdId);

      expect(result).toEqual({
        total_users: 0,
        enabled_users: 0,
        by_channel: {},
        by_digest_frequency: {},
        quiet_hours_enabled: 0,
      });
    });

    it('should count quiet hours modes correctly', async () => {
      const preferences = [
        { ...mockPreferences, quiet_hours_mode: QuietHoursMode.ENABLED },
        { ...mockPreferences, quiet_hours_mode: QuietHoursMode.WEEKDAYS_ONLY },
        { ...mockPreferences, quiet_hours_mode: QuietHoursMode.DISABLED },
      ];
      repository.find.mockResolvedValue(preferences as any);

      const result = await service.getPreferencesStats(mockHouseholdId);

      expect(result.quiet_hours_enabled).toBe(2); // ENABLED and PRIORITY_ONLY
    });
  });
});
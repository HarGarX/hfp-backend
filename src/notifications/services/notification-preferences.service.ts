import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreferences, DigestFrequency, QuietHoursMode } from '../entities/notification-preferences.entity';
import { NotificationType, NotificationChannel, NotificationPriority } from '../entities/notification.entity';
import {
  CreateNotificationPreferencesDto,
  UpdateNotificationPreferencesDto,
  QuickPreferencesDto,
} from '../dto/notification-preferences.dto';

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectRepository(NotificationPreferences)
    private readonly preferencesRepository: Repository<NotificationPreferences>,
  ) {}

  async create(
    householdId: string,
    userId: string,
    createDto: CreateNotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    // Check if preferences already exist for this user
    const existing = await this.preferencesRepository.findOne({
      where: { household_id: householdId, user_id: userId },
    });

    if (existing) {
      throw new ConflictException('Notification preferences already exist for this user');
    }

    const preferences = this.preferencesRepository.create({
      ...createDto,
      household_id: householdId,
      user_id: userId,
    });

    return await this.preferencesRepository.save(preferences);
  }

  async findByUser(householdId: string, userId: string): Promise<NotificationPreferences | null> {
    return await this.preferencesRepository.findOne({
      where: { household_id: householdId, user_id: userId },
      relations: ['user'],
    });
  }

  async findOrCreate(
    householdId: string,
    userId: string,
  ): Promise<NotificationPreferences> {
    let preferences = await this.findByUser(householdId, userId);

    if (!preferences) {
      // Create default preferences
      const defaultDto: CreateNotificationPreferencesDto = {
        enabled: true,
        enabled_channels: [NotificationChannel.IN_APP],
        digest_frequency: DigestFrequency.WEEKLY,
        quiet_hours_mode: QuietHoursMode.ENABLED,
        minimum_priority: NotificationPriority.LOW,
        urgent_override_threshold: NotificationPriority.HIGH,
      };

      preferences = await this.create(householdId, userId, defaultDto);
    }

    return preferences;
  }

  async update(
    householdId: string,
    userId: string,
    updateDto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    const preferences = await this.findByUser(householdId, userId);

    if (!preferences) {
      throw new NotFoundException('Notification preferences not found');
    }

    Object.assign(preferences, updateDto);
    return await this.preferencesRepository.save(preferences);
  }

  async updateQuick(
    householdId: string,
    userId: string,
    quickDto: QuickPreferencesDto,
  ): Promise<NotificationPreferences> {
    const preferences = await this.findOrCreate(householdId, userId);

    // Apply quick updates
    if (quickDto.enabled !== undefined) {
      preferences.enabled = quickDto.enabled;
    }

    if (quickDto.digest_frequency !== undefined) {
      preferences.digest_frequency = quickDto.digest_frequency;
    }

    // Handle channel toggles
    const channels = [...preferences.enabled_channels];

    if (quickDto.email_enabled !== undefined) {
      if (quickDto.email_enabled && !channels.includes(NotificationChannel.EMAIL)) {
        channels.push(NotificationChannel.EMAIL);
      } else if (!quickDto.email_enabled) {
        const index = channels.indexOf(NotificationChannel.EMAIL);
        if (index > -1) channels.splice(index, 1);
      }
    }

    if (quickDto.sms_enabled !== undefined) {
      if (quickDto.sms_enabled && !channels.includes(NotificationChannel.SMS)) {
        channels.push(NotificationChannel.SMS);
      } else if (!quickDto.sms_enabled) {
        const index = channels.indexOf(NotificationChannel.SMS);
        if (index > -1) channels.splice(index, 1);
      }
    }

    if (quickDto.push_enabled !== undefined) {
      if (quickDto.push_enabled && !channels.includes(NotificationChannel.PUSH)) {
        channels.push(NotificationChannel.PUSH);
      } else if (!quickDto.push_enabled) {
        const index = channels.indexOf(NotificationChannel.PUSH);
        if (index > -1) channels.splice(index, 1);
      }
    }

    // Ensure IN_APP is always enabled if any notifications are enabled
    if (preferences.enabled && !channels.includes(NotificationChannel.IN_APP)) {
      channels.push(NotificationChannel.IN_APP);
    }

    preferences.enabled_channels = channels;

    return await this.preferencesRepository.save(preferences);
  }

  async remove(householdId: string, userId: string): Promise<void> {
    const preferences = await this.findByUser(householdId, userId);

    if (!preferences) {
      throw new NotFoundException('Notification preferences not found');
    }

    await this.preferencesRepository.softDelete(preferences.id);
  }

  async getTypeSettings(
    householdId: string,
    userId: string,
    type: NotificationType,
  ): Promise<{
    enabled: boolean;
    channels: NotificationChannel[];
    minimum_priority: NotificationPriority;
    delay_minutes: number;
  }> {
    const preferences = await this.findOrCreate(householdId, userId);
    const typeSettings = preferences.type_settings[type] || {};

    return {
      enabled: typeSettings.enabled ?? true,
      channels: typeSettings.channels || preferences.enabled_channels,
      minimum_priority: typeSettings.minimum_priority || preferences.minimum_priority,
      delay_minutes: typeSettings.delay_minutes || 0,
    };
  }

  async updateTypeSettings(
    householdId: string,
    userId: string,
    type: NotificationType,
    settings: {
      enabled?: boolean;
      channels?: NotificationChannel[];
      minimum_priority?: NotificationPriority;
      delay_minutes?: number;
    },
  ): Promise<NotificationPreferences> {
    const preferences = await this.findOrCreate(householdId, userId);

    if (!preferences.type_settings) {
      preferences.type_settings = {} as any;
    }

    preferences.type_settings[type] = {
      ...preferences.type_settings[type],
      ...settings,
    };

    return await this.preferencesRepository.save(preferences);
  }

  async getChannelSettings(
    householdId: string,
    userId: string,
    channel: NotificationChannel,
  ): Promise<any> {
    const preferences = await this.findOrCreate(householdId, userId);
    return preferences.channel_settings[channel] || {};
  }

  async updateChannelSettings(
    householdId: string,
    userId: string,
    channel: NotificationChannel,
    settings: any,
  ): Promise<NotificationPreferences> {
    const preferences = await this.findOrCreate(householdId, userId);

    if (!preferences.channel_settings) {
      preferences.channel_settings = {};
    }

    preferences.channel_settings[channel] = {
      ...preferences.channel_settings[channel],
      ...settings,
    };

    return await this.preferencesRepository.save(preferences);
  }

  async verifyChannel(
    householdId: string,
    userId: string,
    channel: NotificationChannel,
    verificationCode?: string,
  ): Promise<boolean> {
    const preferences = await this.findOrCreate(householdId, userId);

    // In a real implementation, you would verify the code here
    // For now, we'll just mark as verified
    if (!preferences.channel_settings) {
      preferences.channel_settings = {};
    }

    if (!preferences.channel_settings[channel]) {
      preferences.channel_settings[channel] = {};
    }

    preferences.channel_settings[channel].verified = true;

    await this.preferencesRepository.save(preferences);
    return true;
  }

  async getDigestPreferences(householdId: string, userId: string): Promise<{
    frequency: DigestFrequency;
    time: string;
    days: number[];
    should_send_today: boolean;
  }> {
    const preferences = await this.findOrCreate(householdId, userId);

    return {
      frequency: preferences.digest_frequency,
      time: preferences.digest_time || '09:00',
      days: preferences.digest_days || [1], // Default to Monday
      should_send_today: preferences.should_send_digest_today,
    };
  }

  async getUsersForDigest(
    householdId: string,
    frequency: DigestFrequency,
  ): Promise<NotificationPreferences[]> {
    return await this.preferencesRepository.find({
      where: {
        household_id: householdId,
        enabled: true,
        digest_frequency: frequency,
      },
      relations: ['user'],
    });
  }

  async isInQuietHours(householdId: string, userId: string): Promise<boolean> {
    const preferences = await this.findOrCreate(householdId, userId);
    return preferences.is_in_quiet_hours;
  }

  async canReceiveNotification(
    householdId: string,
    userId: string,
    type: NotificationType,
    priority: NotificationPriority,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const preferences = await this.findOrCreate(householdId, userId);
    return preferences.canReceiveNotification(type, priority, channel);
  }

  async getEffectiveChannels(
    householdId: string,
    userId: string,
  ): Promise<NotificationChannel[]> {
    const preferences = await this.findOrCreate(householdId, userId);
    return preferences.effective_channels;
  }

  async getAllPreferences(householdId: string): Promise<NotificationPreferences[]> {
    return await this.preferencesRepository.find({
      where: { household_id: householdId },
      relations: ['user'],
    });
  }

  async getPreferencesStats(householdId: string): Promise<{
    total_users: number;
    enabled_users: number;
    by_channel: Record<NotificationChannel, number>;
    by_digest_frequency: Record<DigestFrequency, number>;
    quiet_hours_enabled: number;
  }> {
    const preferences = await this.getAllPreferences(householdId);

    const stats = {
      total_users: preferences.length,
      enabled_users: 0,
      by_channel: {} as Record<NotificationChannel, number>,
      by_digest_frequency: {} as Record<DigestFrequency, number>,
      quiet_hours_enabled: 0,
    };

    preferences.forEach(pref => {
      if (pref.enabled) {
        stats.enabled_users++;
      }

      pref.enabled_channels.forEach(channel => {
        stats.by_channel[channel] = (stats.by_channel[channel] || 0) + 1;
      });

      stats.by_digest_frequency[pref.digest_frequency] = 
        (stats.by_digest_frequency[pref.digest_frequency] || 0) + 1;

      if (pref.quiet_hours_mode !== QuietHoursMode.DISABLED) {
        stats.quiet_hours_enabled++;
      }
    });

    return stats;
  }
}
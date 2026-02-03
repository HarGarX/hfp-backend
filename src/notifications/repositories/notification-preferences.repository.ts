import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from '../../../libs/tenant/repositories/base.repository';
import { NotificationPreferences } from '../entities/notification-preferences.entity';

@Injectable()
export class NotificationPreferencesRepository extends BaseRepository<NotificationPreferences> {
  constructor(private dataSource: DataSource) {
    super(NotificationPreferences, dataSource.createEntityManager());
  }
}

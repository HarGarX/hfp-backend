import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Notification } from './entities/notification.entity';
import { NotificationPreferences } from './entities/notification-preferences.entity';
import { NotificationTemplate } from './entities/notification-template.entity';

// Services
import { NotificationsService } from './services/notifications.service';
import { NotificationPreferencesService } from './services/notification-preferences.service';
import { NotificationTemplateService } from './services/notification-template.service';

// Controllers
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationPreferencesController } from './controllers/notification-preferences.controller';
import { NotificationTemplatesController } from './controllers/notification-templates.controller';

// Repositories
import { NotificationRepository } from './repositories/notification.repository';
import { NotificationPreferencesRepository } from './repositories/notification-preferences.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationPreferences,
      NotificationTemplate,
    ]),
  ],
  controllers: [
    NotificationsController,
    NotificationPreferencesController,
    NotificationTemplatesController,
  ],
  providers: [
    NotificationsService,
    NotificationPreferencesService,
    NotificationTemplateService,
    NotificationRepository,
    NotificationPreferencesRepository,
  ],
  exports: [
    NotificationsService,
    NotificationPreferencesService,
    NotificationTemplateService,
  ],
})
export class NotificationsModule {}

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextInterceptor } from '../../shared/interceptors/tenant-context.interceptor';
import { HouseholdGuard } from '../../shared/guards/household.guard';
import { RequireRole } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { NotificationStatus } from '../entities/notification.entity';
import { NotificationsService } from '../services/notifications.service';
import { CreateNotificationDto, BulkCreateNotificationDto } from '../dto/create-notification.dto';
import {
  UpdateNotificationDto,
  MarkNotificationReadDto,
  BulkUpdateNotificationsDto,
} from '../dto/update-notification.dto';
import { QueryNotificationsDto, NotificationStatsDto } from '../dto/query-notifications.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard, HouseholdGuard)
@UseInterceptors(TenantContextInterceptor)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @ApiOperation({ summary: 'Create a new notification' })
  @ApiResponse({
    status: 201,
    description: 'Notification created successfully',
  })
  async create(
    @Request() req: any,
    @Body() createNotificationDto: CreateNotificationDto,
  ) {
    return await this.notificationsService.create(
      req.user.household_id,
      createNotificationDto,
    );
  }

  @Get()
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get all notifications for the household' })
  @ApiResponse({
    status: 200,
    description: 'List of notifications with pagination',
  })
  async findAll(
    @Request() req: any,
    @Query() queryDto: QueryNotificationsDto,
  ) {
    return await this.notificationsService.findAll(
      req.user.household_id,
      queryDto,
    );
  }

  @Get('my')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get notifications for the current user' })
  @ApiResponse({
    status: 200,
    description: 'List of user notifications',
  })
  async findMy(
    @Request() req: any,
    @Query() queryDto: QueryNotificationsDto,
  ) {
    const userQueryDto = { ...queryDto, user_id: req.user.id };
    return await this.notificationsService.findAll(
      req.user.household_id,
      userQueryDto,
    );
  }

  @Get('unread-count')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({
    status: 200,
    description: 'Unread notification count',
  })
  async getUnreadCount(@Request() req: any) {
    const count = await this.notificationsService.getUnreadCount(
      req.user.household_id,
      req.user.id,
    );
    return { count };
  }

  @Get(':id')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get a specific notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification details',
  })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return await this.notificationsService.findOne(req.user.household_id, id);
  }

  @Patch(':id/read')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
  })
  async markAsRead(
    @Request() req: any,
    @Param('id') id: string,
    @Body() markReadDto: MarkNotificationReadDto,
  ) {
    return await this.notificationsService.markAsRead(
      req.user.household_id,
      id,
      markReadDto.clicked_url,
    );
  }

  @Delete(':id')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN)
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
  })
  async remove(@Request() req: any, @Param('id') id: string) {
    await this.notificationsService.remove(req.user.household_id, id);
    return { message: 'Notification deleted successfully' };
  }
}
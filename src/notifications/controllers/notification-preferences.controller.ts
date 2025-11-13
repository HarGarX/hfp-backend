import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { KeycloakAuthGuard } from '../../auth/guards/keycloak-auth.guard';
import { HouseholdGuard } from '../../shared/guards/household.guard';
import { RequireRole } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { NotificationPreferencesService } from '../services/notification-preferences.service';
import {
  CreateNotificationPreferencesDto,
  UpdateNotificationPreferencesDto,
  QuickPreferencesDto,
} from '../dto/notification-preferences.dto';
import { NotificationType, NotificationChannel } from '../entities/notification.entity';

@ApiTags('Notification Preferences')
@ApiBearerAuth()
@Controller('notification-preferences')
@UseGuards(KeycloakAuthGuard, HouseholdGuard)
export class NotificationPreferencesController {
  constructor(
    private readonly preferencesService: NotificationPreferencesService,
  ) {}

  @Post()
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Create notification preferences' })
  @ApiResponse({
    status: 201,
    description: 'Preferences created successfully',
  })
  async create(
    @Request() req: any,
    @Body() createDto: CreateNotificationPreferencesDto,
  ) {
    return await this.preferencesService.create(
      req.user.household_id,
      req.user.id,
      createDto,
    );
  }

  @Get()
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get current user notification preferences' })
  @ApiResponse({
    status: 200,
    description: 'User notification preferences',
  })
  async findMy(@Request() req: any) {
    return await this.preferencesService.findOrCreate(
      req.user.household_id,
      req.user.id,
    );
  }

  @Get('all')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN)
  @ApiOperation({ summary: 'Get all household notification preferences' })
  @ApiResponse({
    status: 200,
    description: 'All household notification preferences',
  })
  async findAll(@Request() req: any) {
    return await this.preferencesService.getAllPreferences(
      req.user.household_id,
    );
  }

  @Get('stats')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN)
  @ApiOperation({ summary: 'Get notification preferences statistics' })
  @ApiResponse({
    status: 200,
    description: 'Preferences statistics',
  })
  async getStats(@Request() req: any) {
    return await this.preferencesService.getPreferencesStats(
      req.user.household_id,
    );
  }

  @Get('digest')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get digest preferences' })
  @ApiResponse({
    status: 200,
    description: 'Digest preferences',
  })
  async getDigestPreferences(@Request() req: any) {
    return await this.preferencesService.getDigestPreferences(
      req.user.household_id,
      req.user.id,
    );
  }

  @Get('type/:type')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get preferences for a specific notification type' })
  @ApiParam({ name: 'type', enum: NotificationType })
  @ApiResponse({
    status: 200,
    description: 'Type-specific preferences',
  })
  async getTypeSettings(
    @Request() req: any,
    @Param('type') type: NotificationType,
  ) {
    return await this.preferencesService.getTypeSettings(
      req.user.household_id,
      req.user.id,
      type,
    );
  }

  @Get('channel/:channel')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get preferences for a specific channel' })
  @ApiParam({ name: 'channel', enum: NotificationChannel })
  @ApiResponse({
    status: 200,
    description: 'Channel-specific preferences',
  })
  async getChannelSettings(
    @Request() req: any,
    @Param('channel') channel: NotificationChannel,
  ) {
    return await this.preferencesService.getChannelSettings(
      req.user.household_id,
      req.user.id,
      channel,
    );
  }

  @Patch()
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiResponse({
    status: 200,
    description: 'Preferences updated successfully',
  })
  async update(
    @Request() req: any,
    @Body() updateDto: UpdateNotificationPreferencesDto,
  ) {
    return await this.preferencesService.update(
      req.user.household_id,
      req.user.id,
      updateDto,
    );
  }

  @Patch('quick')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Quick update common preferences' })
  @ApiResponse({
    status: 200,
    description: 'Quick preferences updated successfully',
  })
  async updateQuick(
    @Request() req: any,
    @Body() quickDto: QuickPreferencesDto,
  ) {
    return await this.preferencesService.updateQuick(
      req.user.household_id,
      req.user.id,
      quickDto,
    );
  }

  @Patch('type/:type')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Update preferences for a specific notification type' })
  @ApiParam({ name: 'type', enum: NotificationType })
  @ApiResponse({
    status: 200,
    description: 'Type preferences updated successfully',
  })
  async updateTypeSettings(
    @Request() req: any,
    @Param('type') type: NotificationType,
    @Body() settings: any,
  ) {
    return await this.preferencesService.updateTypeSettings(
      req.user.household_id,
      req.user.id,
      type,
      settings,
    );
  }

  @Patch('channel/:channel')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Update preferences for a specific channel' })
  @ApiParam({ name: 'channel', enum: NotificationChannel })
  @ApiResponse({
    status: 200,
    description: 'Channel preferences updated successfully',
  })
  async updateChannelSettings(
    @Request() req: any,
    @Param('channel') channel: NotificationChannel,
    @Body() settings: any,
  ) {
    return await this.preferencesService.updateChannelSettings(
      req.user.household_id,
      req.user.id,
      channel,
      settings,
    );
  }

  @Post('verify/:channel')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Verify a notification channel' })
  @ApiParam({ name: 'channel', enum: NotificationChannel })
  @ApiResponse({
    status: 200,
    description: 'Channel verification result',
  })
  async verifyChannel(
    @Request() req: any,
    @Param('channel') channel: NotificationChannel,
    @Body() body: { verification_code?: string },
  ) {
    const success = await this.preferencesService.verifyChannel(
      req.user.household_id,
      req.user.id,
      channel,
      body.verification_code,
    );
    
    return {
      success,
      message: success ? 'Channel verified successfully' : 'Verification failed',
    };
  }

  @Delete()
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Delete notification preferences (reset to defaults)' })
  @ApiResponse({
    status: 200,
    description: 'Preferences deleted successfully',
  })
  async remove(@Request() req: any) {
    await this.preferencesService.remove(req.user.household_id, req.user.id);
    return { message: 'Preferences reset to defaults' };
  }
}
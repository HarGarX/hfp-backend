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
import { HouseholdGuard } from '../../shared/guards/household.guard';
import { RequireRole } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { NotificationTemplateService } from '../services/notification-template.service';
import {
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
  RenderTemplateDto,
  TestTemplateDto,
} from '../dto/notification-template.dto';
import {
  NotificationType,
  NotificationChannel,
} from '../entities/notification.entity';
import { TemplateStatus } from '../entities/notification-template.entity';

@ApiTags('Notification Templates')
@ApiBearerAuth()
@Controller('notification-templates')
@UseGuards(JwtAuthGuard, HouseholdGuard)
export class NotificationTemplatesController {
  constructor(
    private readonly templateService: NotificationTemplateService,
  ) {}

  @Post()
  @RequireRole(UserRole.HOUSEHOLD_ADMIN)
  @ApiOperation({ summary: 'Create a new notification template' })
  @ApiResponse({
    status: 201,
    description: 'Template created successfully',
  })
  async create(
    @Request() req: any,
    @Body() createDto: CreateNotificationTemplateDto,
  ) {
    return await this.templateService.create(req.user.household_id, createDto);
  }

  @Get()
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @ApiOperation({ summary: 'Get all notification templates' })
  @ApiQuery({ name: 'type', required: false, enum: NotificationType })
  @ApiQuery({ name: 'channel', required: false, enum: NotificationChannel })
  @ApiQuery({ name: 'status', required: false, enum: TemplateStatus })
  @ApiResponse({
    status: 200,
    description: 'List of notification templates',
  })
  async findAll(
    @Request() req: any,
    @Query('type') type?: NotificationType,
    @Query('channel') channel?: NotificationChannel,
    @Query('status') status?: TemplateStatus,
  ) {
    const filters = { type, channel, status };
    return await this.templateService.findAll(req.user.household_id, filters);
  }

  @Get('type/:type')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @ApiOperation({ summary: 'Get templates for a specific notification type' })
  @ApiParam({ name: 'type', enum: NotificationType })
  @ApiResponse({
    status: 200,
    description: 'Templates for the specified type',
  })
  async findByType(
    @Request() req: any,
    @Param('type') type: NotificationType,
  ) {
    return await this.templateService.getTemplatesForType(
      req.user.household_id,
      type,
    );
  }

  @Get('channel/:channel')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @ApiOperation({ summary: 'Get templates for a specific channel' })
  @ApiParam({ name: 'channel', enum: NotificationChannel })
  @ApiResponse({
    status: 200,
    description: 'Templates for the specified channel',
  })
  async findByChannel(
    @Request() req: any,
    @Param('channel') channel: NotificationChannel,
  ) {
    return await this.templateService.getTemplatesForChannel(
      req.user.household_id,
      channel,
    );
  }

  @Get(':id')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @ApiOperation({ summary: 'Get a specific notification template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({
    status: 200,
    description: 'Template details',
  })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return await this.templateService.findOne(req.user.household_id, id);
  }

  @Get(':id/usage-stats')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @ApiOperation({ summary: 'Get template usage statistics' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({
    status: 200,
    description: 'Template usage statistics',
  })
  async getUsageStats(@Request() req: any, @Param('id') id: string) {
    return await this.templateService.getUsageStats(req.user.household_id, id);
  }

  @Post(':id/render')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @ApiOperation({ summary: 'Render a template with variables' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({
    status: 200,
    description: 'Rendered template content',
  })
  async render(
    @Request() req: any,
    @Param('id') id: string,
    @Body() renderDto: RenderTemplateDto,
  ) {
    return await this.templateService.render(
      req.user.household_id,
      id,
      renderDto,
    );
  }

  @Post(':id/test')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @ApiOperation({ summary: 'Test a template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({
    status: 200,
    description: 'Template test results',
  })
  async test(
    @Request() req: any,
    @Param('id') id: string,
    @Body() testDto: TestTemplateDto,
  ) {
    return await this.templateService.test(req.user.household_id, id, testDto);
  }

  @Post(':id/duplicate')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN)
  @ApiOperation({ summary: 'Duplicate a template' })
  @ApiParam({ name: 'id', description: 'Template ID to duplicate' })
  @ApiResponse({
    status: 201,
    description: 'Template duplicated successfully',
  })
  async duplicate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { name: string },
  ) {
    return await this.templateService.duplicate(
      req.user.household_id,
      id,
      body.name,
    );
  }

  @Post('validate')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN)
  @ApiOperation({ summary: 'Validate a template' })
  @ApiResponse({
    status: 200,
    description: 'Template validation results',
  })
  async validate(
    @Body() template: Partial<CreateNotificationTemplateDto>,
  ) {
    return await this.templateService.validateTemplate(template);
  }

  @Patch(':id')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN)
  @ApiOperation({ summary: 'Update a notification template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({
    status: 200,
    description: 'Template updated successfully',
  })
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateDto: UpdateNotificationTemplateDto,
  ) {
    return await this.templateService.update(
      req.user.household_id,
      id,
      updateDto,
    );
  }

  @Patch(':id/activate')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN)
  @ApiOperation({ summary: 'Activate a template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({
    status: 200,
    description: 'Template activated successfully',
  })
  async activate(@Request() req: any, @Param('id') id: string) {
    return await this.templateService.activate(req.user.household_id, id);
  }

  @Patch(':id/archive')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN)
  @ApiOperation({ summary: 'Archive a template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({
    status: 200,
    description: 'Template archived successfully',
  })
  async archive(@Request() req: any, @Param('id') id: string) {
    return await this.templateService.archive(req.user.household_id, id);
  }

  @Delete(':id')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN)
  @ApiOperation({ summary: 'Delete a notification template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({
    status: 200,
    description: 'Template deleted successfully',
  })
  async remove(@Request() req: any, @Param('id') id: string) {
    await this.templateService.remove(req.user.household_id, id);
    return { message: 'Template deleted successfully' };
  }
}
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { NotificationTemplate, TemplateStatus } from '../entities/notification-template.entity';
import { NotificationType, NotificationChannel } from '../entities/notification.entity';
import {
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
  RenderTemplateDto,
  TestTemplateDto,
} from '../dto/notification-template.dto';

@Injectable()
export class NotificationTemplateService {
  constructor(
    @InjectRepository(NotificationTemplate)
    private readonly templateRepository: Repository<NotificationTemplate>,
  ) {}

  async create(
    householdId: string,
    createDto: CreateNotificationTemplateDto,
  ): Promise<NotificationTemplate> {
    // Check if template with same name already exists
    const existing = await this.templateRepository.findOne({
      where: {
        household_id: householdId,
        type: createDto.type,
        channel: createDto.channel,
        name: createDto.name,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Template '${createDto.name}' already exists for ${createDto.type} on ${createDto.channel}`
      );
    }

    const template = this.templateRepository.create({
      ...createDto,
      household_id: householdId,
      status: TemplateStatus.ACTIVE,
    });

    return await this.templateRepository.save(template);
  }

  async findAll(
    householdId: string,
    filters?: {
      type?: NotificationType;
      channel?: NotificationChannel;
      status?: TemplateStatus;
    },
  ): Promise<NotificationTemplate[]> {
    const where: FindOptionsWhere<NotificationTemplate> = {
      household_id: householdId,
    };

    if (filters?.type) where.type = filters.type;
    if (filters?.channel) where.channel = filters.channel;
    if (filters?.status) where.status = filters.status;

    return await this.templateRepository.find({
      where,
      order: { type: 'ASC', channel: 'ASC', name: 'ASC' },
    });
  }

  async findOne(householdId: string, id: string): Promise<NotificationTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id, household_id: householdId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async findByName(
    householdId: string,
    name: string,
    type: NotificationType,
    channel: NotificationChannel,
  ): Promise<NotificationTemplate> {
    const template = await this.templateRepository.findOne({
      where: {
        household_id: householdId,
        name,
        type,
        channel,
        status: TemplateStatus.ACTIVE,
      },
    });

    if (!template) {
      throw new NotFoundException(
        `Template '${name}' not found for ${type} on ${channel}`
      );
    }

    return template;
  }

  async update(
    householdId: string,
    id: string,
    updateDto: UpdateNotificationTemplateDto,
  ): Promise<NotificationTemplate> {
    const template = await this.findOne(householdId, id);

    if (!template.is_customizable && template.is_system_template) {
      throw new BadRequestException('System templates cannot be modified');
    }

    Object.assign(template, updateDto);
    return await this.templateRepository.save(template);
  }

  async remove(householdId: string, id: string): Promise<void> {
    const template = await this.findOne(householdId, id);

    if (template.is_system_template) {
      throw new BadRequestException('System templates cannot be deleted');
    }

    await this.templateRepository.softDelete(template.id);
  }

  async archive(householdId: string, id: string): Promise<NotificationTemplate> {
    const template = await this.findOne(householdId, id);
    template.status = TemplateStatus.ARCHIVED;
    return await this.templateRepository.save(template);
  }

  async activate(householdId: string, id: string): Promise<NotificationTemplate> {
    const template = await this.findOne(householdId, id);
    template.status = TemplateStatus.ACTIVE;
    return await this.templateRepository.save(template);
  }

  async render(
    householdId: string,
    id: string,
    renderDto: RenderTemplateDto,
  ): Promise<{
    subject: string;
    body: string;
    html?: string;
    estimated_length: number;
    validation: {
      isValid: boolean;
      missingRequired: string[];
      invalidTypes: string[];
    };
  }> {
    const template = await this.findOne(householdId, id);

    // Validate variables
    const validation = template.validateVariables(renderDto.variables);

    if (!validation.isValid) {
      throw new BadRequestException(
        `Template validation failed: ${JSON.stringify(validation)}`
      );
    }

    // Render template
    const rendered = template.renderTemplate(renderDto.variables, renderDto.locale);

    return {
      ...rendered,
      estimated_length: template.estimated_length,
      validation,
    };
  }

  async renderByName(
    householdId: string,
    name: string,
    type: NotificationType,
    channel: NotificationChannel,
    renderDto: RenderTemplateDto,
  ): Promise<{
    subject: string;
    body: string;
    html?: string;
    estimated_length: number;
  }> {
    const template = await this.findByName(householdId, name, type, channel);
    const result = await this.render(householdId, template.id, renderDto);
    
    return {
      subject: result.subject,
      body: result.body,
      html: result.html,
      estimated_length: result.estimated_length,
    };
  }

  async test(
    householdId: string,
    id: string,
    testDto: TestTemplateDto,
  ): Promise<{
    success: boolean;
    message: string;
    rendered?: {
      subject: string;
      body: string;
      html?: string;
    };
  }> {
    const template = await this.findOne(householdId, id);

    try {
      // Validate and render
      const validation = template.validateVariables(testDto.variables);
      if (!validation.isValid) {
        return {
          success: false,
          message: `Validation failed: ${validation.missingRequired.join(', ')} required, ${validation.invalidTypes.join(', ')} invalid types`,
        };
      }

      const rendered = template.renderTemplate(testDto.variables, testDto.locale);

      // Check length limits for SMS
      if (template.channel === NotificationChannel.SMS && rendered.body.length > 160) {
        return {
          success: false,
          message: `SMS body too long: ${rendered.body.length} characters (max 160)`,
          rendered,
        };
      }

      // In a real implementation, you would send test notifications here
      // For now, just return success

      return {
        success: true,
        message: 'Template rendered successfully',
        rendered,
      };
    } catch (error) {
      return {
        success: false,
        message: `Template error: ${error.message}`,
      };
    }
  }

  async duplicate(
    householdId: string,
    id: string,
    newName: string,
  ): Promise<NotificationTemplate> {
    const original = await this.findOne(householdId, id);

    const duplicateDto: CreateNotificationTemplateDto = {
      name: newName,
      description: `Copy of ${original.description || original.name}`,
      type: original.type,
      channel: original.channel,
      subject_template: original.subject_template,
      body_template: original.body_template,
      html_template: original.html_template,
      default_priority: original.default_priority,
      template_variables: original.template_variables,
      styling: original.styling,
      locale: original.locale,
      translations: original.translations,
      version: '1.0.0',
    };

    return await this.create(householdId, duplicateDto);
  }

  async getUsageStats(
    householdId: string,
    id: string,
  ): Promise<{
    usage_count: number;
    last_used_at?: Date;
    success_rate: number;
    avg_delivery_time?: number;
    avg_read_time?: number;
  }> {
    const template = await this.findOne(householdId, id);

    // In a real implementation, you would calculate these from notification records
    // For now, return the stored values
    return {
      usage_count: template.usage_count,
      last_used_at: template.last_used_at,
      success_rate: template.success_rate,
      avg_delivery_time: undefined, // Would calculate from notification delivery times
      avg_read_time: undefined, // Would calculate from notification read times
    };
  }

  async incrementUsage(
    householdId: string,
    id: string,
    successful: boolean = true,
  ): Promise<void> {
    const template = await this.findOne(householdId, id);

    template.usage_count += 1;
    template.last_used_at = new Date();

    // Update success rate (simplified calculation)
    if (template.usage_count === 1) {
      template.success_rate = successful ? 100 : 0;
    } else {
      const currentSuccesses = Math.round((template.success_rate / 100) * (template.usage_count - 1));
      const newSuccesses = currentSuccesses + (successful ? 1 : 0);
      template.success_rate = Math.round((newSuccesses / template.usage_count) * 100);
    }

    await this.templateRepository.save(template);
  }

  async getTemplatesForType(
    householdId: string,
    type: NotificationType,
  ): Promise<NotificationTemplate[]> {
    return await this.templateRepository.find({
      where: {
        household_id: householdId,
        type,
        status: TemplateStatus.ACTIVE,
      },
      order: { channel: 'ASC', name: 'ASC' },
    });
  }

  async getTemplatesForChannel(
    householdId: string,
    channel: NotificationChannel,
  ): Promise<NotificationTemplate[]> {
    return await this.templateRepository.find({
      where: {
        household_id: householdId,
        channel,
        status: TemplateStatus.ACTIVE,
      },
      order: { type: 'ASC', name: 'ASC' },
    });
  }

  async validateTemplate(template: Partial<NotificationTemplate>): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!template.subject_template) {
      errors.push('Subject template is required');
    }

    if (!template.body_template) {
      errors.push('Body template is required');
    }

    // Template variable consistency
    if (template.template_variables && template.body_template) {
      const variableNames = Object.keys(template.template_variables);
      const templateText = template.body_template + (template.subject_template || '');
      
      // Check for unused variables
      variableNames.forEach(varName => {
        if (!templateText.includes(`{{${varName}}}`)) {
          warnings.push(`Variable '${varName}' is defined but not used in template`);
        }
      });

      // Check for undefined variables
      const usedVariables = templateText.match(/\{\{(\w+)\}\}/g) || [];
      usedVariables.forEach(match => {
        const varName = match.slice(2, -2);
        if (!variableNames.includes(varName)) {
          errors.push(`Variable '${varName}' is used but not defined`);
        }
      });
    }

    // Channel-specific validation
    if (template.channel === NotificationChannel.SMS) {
      if (template.html_template) {
        warnings.push('HTML template is not used for SMS notifications');
      }

      // Estimate SMS length
      if (template.body_template && template.body_template.length > 160) {
        warnings.push(`SMS template may be too long: ${template.body_template.length} characters`);
      }
    }

    if (template.channel === NotificationChannel.EMAIL) {
      if (!template.html_template) {
        warnings.push('Consider adding HTML template for better email formatting');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
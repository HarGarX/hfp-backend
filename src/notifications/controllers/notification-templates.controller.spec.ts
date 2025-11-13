import { Test, TestingModule } from '@nestjs/testing';
import { NotificationTemplatesController } from './notification-templates.controller';
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
import { UserRole } from '../../users/entities/user.entity';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('NotificationTemplatesController', () => {
  let controller: NotificationTemplatesController;
  let service: jest.Mocked<NotificationTemplateService>;

  const mockHouseholdId = 'household-123';
  const mockUserId = 'user-123';

  const mockRequest = {
    user: {
      id: mockUserId,
      household_id: mockHouseholdId,
      role: UserRole.HOUSEHOLD_ADMIN,
    },
  };

  const mockTemplate = {
    id: 'template-123',
    name: 'Budget Alert Template',
    description: 'Template for budget exceeded notifications',
    type: NotificationType.BUDGET_EXCEEDED,
    channel: NotificationChannel.EMAIL,
    subject_template: 'Budget Alert: {{category}} budget exceeded',
    body_template: 'Your {{category}} budget of ${{limit}} has been exceeded by ${{amount}}',
    status: TemplateStatus.ACTIVE,
    variables: ['category', 'limit', 'amount'],
    household_id: mockHouseholdId,
    created_at: new Date(),
    updated_at: new Date(),
    usage_count: 5,
  };

  const mockTemplatesList = [mockTemplate];

  const mockUsageStats = {
    template_id: 'template-123',
    total_sent: 25,
    total_delivered: 22,
    total_opened: 18,
    total_clicked: 12,
    delivery_rate: 88,
    open_rate: 81.8,
    click_rate: 66.7,
    last_sent_at: new Date(),
    popular_variables: {
      category: ['dining', 'entertainment', 'shopping'],
      amount: [150, 200, 75],
    },
  };

  const mockRenderedTemplate = {
    subject: 'Budget Alert: Dining budget exceeded',
    body: 'Your Dining budget of $500 has been exceeded by $150',
    preview_text: 'Dining budget exceeded by $150',
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      getTemplatesForType: jest.fn(),
      getTemplatesForChannel: jest.fn(),
      getUsageStats: jest.fn(),
      render: jest.fn(),
      test: jest.fn(),
      duplicate: jest.fn(),
      validateTemplate: jest.fn(),
      update: jest.fn(),
      activate: jest.fn(),
      archive: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationTemplatesController],
      providers: [
        {
          provide: NotificationTemplateService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<NotificationTemplatesController>(NotificationTemplatesController);
    service = module.get(NotificationTemplateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateNotificationTemplateDto = {
      name: 'New Goal Template',
      description: 'Template for goal milestone notifications',
      type: NotificationType.GOAL_MILESTONE,
      channel: NotificationChannel.IN_APP,
      subject_template: 'Congratulations! Goal "{{goal_name}}" achieved',
      body_template: 'You have successfully reached your goal of ${{target_amount}}!',
      template_variables: {
        goal_name: { type: 'string', required: true, description: 'Name of the goal' },
        target_amount: { type: 'currency', required: true, description: 'Target amount' },
      },
    };

    it('should create a template successfully', async () => {
      service.create.mockResolvedValue(mockTemplate as any);

      const result = await controller.create(mockRequest, createDto);

      expect(service.create).toHaveBeenCalledWith(mockHouseholdId, createDto);
      expect(result).toEqual(mockTemplate);
    });

    it('should handle BadRequestException for invalid template data', async () => {
      service.create.mockRejectedValue(new BadRequestException('Invalid template syntax'));

      await expect(controller.create(mockRequest, createDto)).rejects.toThrow(BadRequestException);
    });

    it('should handle service errors during creation', async () => {
      service.create.mockRejectedValue(new Error('Database connection failed'));

      await expect(controller.create(mockRequest, createDto)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('findAll', () => {
    it('should return all templates without filters', async () => {
      service.findAll.mockResolvedValue(mockTemplatesList as any);

      const result = await controller.findAll(mockRequest);

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, {});
      expect(result).toEqual(mockTemplatesList);
    });

    it('should return templates with type filter', async () => {
      service.findAll.mockResolvedValue(mockTemplatesList as any);

      const result = await controller.findAll(
        mockRequest,
        NotificationType.BUDGET_EXCEEDED,
      );

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, {
        type: NotificationType.BUDGET_EXCEEDED,
        channel: undefined,
        status: undefined,
      });
      expect(result).toEqual(mockTemplatesList);
    });

    it('should return templates with all filters', async () => {
      service.findAll.mockResolvedValue(mockTemplatesList as any);

      const result = await controller.findAll(
        mockRequest,
        NotificationType.BUDGET_EXCEEDED,
        NotificationChannel.EMAIL,
        TemplateStatus.ACTIVE,
      );

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, {
        type: NotificationType.BUDGET_EXCEEDED,
        channel: NotificationChannel.EMAIL,
        status: TemplateStatus.ACTIVE,
      });
      expect(result).toEqual(mockTemplatesList);
    });

    it('should handle empty results gracefully', async () => {
      service.findAll.mockResolvedValue([] as any);

      const result = await controller.findAll(mockRequest);

      expect(result).toEqual([]);
    });
  });

  describe('findByType', () => {
    it('should return templates for specific type', async () => {
      service.getTemplatesForType.mockResolvedValue(mockTemplatesList as any);

      const result = await controller.findByType(mockRequest, NotificationType.BUDGET_EXCEEDED);

      expect(service.getTemplatesForType).toHaveBeenCalledWith(
        mockHouseholdId,
        NotificationType.BUDGET_EXCEEDED,
      );
      expect(result).toEqual(mockTemplatesList);
    });

    it('should handle no templates for type', async () => {
      service.getTemplatesForType.mockResolvedValue([] as any);

      const result = await controller.findByType(mockRequest, NotificationType.CUSTOM_ALERT);

      expect(result).toEqual([]);
    });
  });

  describe('findByChannel', () => {
    it('should return templates for specific channel', async () => {
      service.getTemplatesForChannel.mockResolvedValue(mockTemplatesList as any);

      const result = await controller.findByChannel(mockRequest, NotificationChannel.EMAIL);

      expect(service.getTemplatesForChannel).toHaveBeenCalledWith(
        mockHouseholdId,
        NotificationChannel.EMAIL,
      );
      expect(result).toEqual(mockTemplatesList);
    });

    it('should handle no templates for channel', async () => {
      service.getTemplatesForChannel.mockResolvedValue([] as any);

      const result = await controller.findByChannel(mockRequest, NotificationChannel.SMS);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    const templateId = 'template-123';

    it('should return a specific template', async () => {
      service.findOne.mockResolvedValue(mockTemplate as any);

      const result = await controller.findOne(mockRequest, templateId);

      expect(service.findOne).toHaveBeenCalledWith(mockHouseholdId, templateId);
      expect(result).toEqual(mockTemplate);
    });

    it('should handle NotFoundException for invalid id', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Template not found'));

      await expect(controller.findOne(mockRequest, 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUsageStats', () => {
    const templateId = 'template-123';

    it('should return template usage statistics', async () => {
      service.getUsageStats.mockResolvedValue(mockUsageStats as any);

      const result = await controller.getUsageStats(mockRequest, templateId);

      expect(service.getUsageStats).toHaveBeenCalledWith(mockHouseholdId, templateId);
      expect(result).toEqual(mockUsageStats);
    });

    it('should handle template with no usage', async () => {
      const emptyStats = {
        template_id: templateId,
        total_sent: 0,
        total_delivered: 0,
        total_opened: 0,
        total_clicked: 0,
        delivery_rate: 0,
        open_rate: 0,
        click_rate: 0,
      };
      service.getUsageStats.mockResolvedValue(emptyStats as any);

      const result = await controller.getUsageStats(mockRequest, templateId);

      expect(result).toEqual(emptyStats);
    });
  });

  describe('render', () => {
    const templateId = 'template-123';
    const renderDto: RenderTemplateDto = {
      variables: {
        category: 'Dining',
        limit: '500',
        amount: '150',
      },
    };

    it('should render template with variables', async () => {
      service.render.mockResolvedValue(mockRenderedTemplate as any);

      const result = await controller.render(mockRequest, templateId, renderDto);

      expect(service.render).toHaveBeenCalledWith(mockHouseholdId, templateId, renderDto);
      expect(result).toEqual(mockRenderedTemplate);
    });

    it('should handle missing variables gracefully', async () => {
      const incompleteRender = {
        subject: 'Budget Alert: {{category}} budget exceeded',
        body: 'Your {{category}} budget has been exceeded',
        errors: ['Missing variable: category'],
      };
      service.render.mockResolvedValue(incompleteRender as any);

      const result = await controller.render(mockRequest, templateId, {
        variables: { limit: '500' },
      });

      expect(result).toEqual(incompleteRender);
    });

    it('should handle NotFoundException for invalid template', async () => {
      service.render.mockRejectedValue(new NotFoundException('Template not found'));

      await expect(controller.render(mockRequest, 'invalid-id', renderDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('test', () => {
    const templateId = 'template-123';
    const testDto: TestTemplateDto = {
      variables: {
        category: 'Dining',
        limit: '500',
        amount: '150',
      },
      test_email: 'test@example.com',
    };

    const testResult = {
      success: true,
      rendered_content: mockRenderedTemplate,
      validation_errors: [],
      test_sent: true,
    };

    it('should test template successfully', async () => {
      service.test.mockResolvedValue(testResult as any);

      const result = await controller.test(mockRequest, templateId, testDto);

      expect(service.test).toHaveBeenCalledWith(mockHouseholdId, templateId, testDto);
      expect(result).toEqual(testResult);
    });

    it('should handle template test with validation errors', async () => {
      const failedTest = {
        success: false,
        validation_errors: ['Invalid email format', 'Missing required variable'],
        test_sent: false,
      };
      service.test.mockResolvedValue(failedTest as any);

      const result = await controller.test(mockRequest, templateId, testDto);

      expect(result).toEqual(failedTest);
    });
  });

  describe('duplicate', () => {
    const templateId = 'template-123';
    const duplicateName = 'Budget Alert Template (Copy)';

    it('should duplicate template successfully', async () => {
      const duplicatedTemplate = { ...mockTemplate, id: 'template-456', name: duplicateName };
      service.duplicate.mockResolvedValue(duplicatedTemplate as any);

      const result = await controller.duplicate(mockRequest, templateId, {
        name: duplicateName,
      });

      expect(service.duplicate).toHaveBeenCalledWith(
        mockHouseholdId,
        templateId,
        duplicateName,
      );
      expect(result).toEqual(duplicatedTemplate);
    });

    it('should handle NotFoundException for invalid template', async () => {
      service.duplicate.mockRejectedValue(new NotFoundException('Template not found'));

      await expect(
        controller.duplicate(mockRequest, 'invalid-id', { name: duplicateName }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validate', () => {
    const templateToValidate = {
      name: 'Test Template',
      subject_template: 'Hello {{name}}',
      body_template: 'Welcome {{name}}! Your balance is {{balance}}',
      variables: ['name', 'balance'],
    };

    it('should validate template successfully', async () => {
      const validationResult = {
        valid: true,
        errors: [],
        warnings: [],
        extracted_variables: ['name', 'balance'],
      };
      service.validateTemplate.mockResolvedValue(validationResult as any);

      const result = await controller.validate(templateToValidate);

      expect(service.validateTemplate).toHaveBeenCalledWith(templateToValidate);
      expect(result).toEqual(validationResult);
    });

    it('should return validation errors', async () => {
      const validationResult = {
        valid: false,
        errors: ['Invalid template syntax', 'Undefined variable: {{unknown}}'],
        warnings: ['Variable {{balance}} used but not declared'],
        extracted_variables: ['name', 'balance', 'unknown'],
      };
      service.validateTemplate.mockResolvedValue(validationResult as any);

      const result = await controller.validate(templateToValidate);

      expect(result).toEqual(validationResult);
    });
  });

  describe('update', () => {
    const templateId = 'template-123';
    const updateDto: UpdateNotificationTemplateDto = {
      name: 'Updated Budget Alert Template',
      subject_template: 'Updated: {{category}} budget alert',
      body_template: 'Your {{category}} budget status has changed',
    };

    it('should update template successfully', async () => {
      const updatedTemplate = { ...mockTemplate, ...updateDto };
      service.update.mockResolvedValue(updatedTemplate as any);

      const result = await controller.update(mockRequest, templateId, updateDto);

      expect(service.update).toHaveBeenCalledWith(mockHouseholdId, templateId, updateDto);
      expect(result).toEqual(updatedTemplate);
    });

    it('should handle NotFoundException for invalid template', async () => {
      service.update.mockRejectedValue(new NotFoundException('Template not found'));

      await expect(controller.update(mockRequest, 'invalid-id', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle BadRequestException for invalid data', async () => {
      service.update.mockRejectedValue(new BadRequestException('Invalid template syntax'));

      await expect(controller.update(mockRequest, templateId, updateDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('activate', () => {
    const templateId = 'template-123';

    it('should activate template successfully', async () => {
      const activatedTemplate = { ...mockTemplate, status: TemplateStatus.ACTIVE };
      service.activate.mockResolvedValue(activatedTemplate as any);

      const result = await controller.activate(mockRequest, templateId);

      expect(service.activate).toHaveBeenCalledWith(mockHouseholdId, templateId);
      expect(result).toEqual(activatedTemplate);
    });

    it('should handle NotFoundException for invalid template', async () => {
      service.activate.mockRejectedValue(new NotFoundException('Template not found'));

      await expect(controller.activate(mockRequest, 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('archive', () => {
    const templateId = 'template-123';

    it('should archive template successfully', async () => {
      const archivedTemplate = { ...mockTemplate, status: TemplateStatus.ARCHIVED };
      service.archive.mockResolvedValue(archivedTemplate as any);

      const result = await controller.archive(mockRequest, templateId);

      expect(service.archive).toHaveBeenCalledWith(mockHouseholdId, templateId);
      expect(result).toEqual(archivedTemplate);
    });

    it('should handle NotFoundException for invalid template', async () => {
      service.archive.mockRejectedValue(new NotFoundException('Template not found'));

      await expect(controller.archive(mockRequest, 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    const templateId = 'template-123';

    it('should delete template successfully', async () => {
      service.remove.mockResolvedValue();

      const result = await controller.remove(mockRequest, templateId);

      expect(service.remove).toHaveBeenCalledWith(mockHouseholdId, templateId);
      expect(result).toEqual({ message: 'Template deleted successfully' });
    });

    it('should handle NotFoundException for invalid template', async () => {
      service.remove.mockRejectedValue(new NotFoundException('Template not found'));

      await expect(controller.remove(mockRequest, 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle ForbiddenException for active templates', async () => {
      service.remove.mockRejectedValue(
        new ForbiddenException('Cannot delete active template'),
      );

      await expect(controller.remove(mockRequest, templateId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
import {
  Controller,
  Post,
  Get,
  Body,
  Patch,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OnboardingStartDto,
  OnboardingMemberDto,
  OnboardingRolesDto,
  OnboardingStatusDto,
} from './dto/onboarding.dto';
import { User } from '../users/entities/user.entity';
import { Household } from '../households/entities/household.entity';

@ApiTags('Onboarding')
@ApiBearerAuth()
@Controller('onboarding')
export class OnboardingController {
  private readonly logger = new Logger(OnboardingController.name);

  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Start onboarding process',
    description: 'Initialize onboarding by creating household and initial user',
  })
  @ApiBody({ type: OnboardingStartDto })
  @ApiResponse({
    status: 201,
    description: 'Onboarding started successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            household: { $ref: '#/components/schemas/Household' },
            user: { $ref: '#/components/schemas/User' },
          },
        },
        message: { type: 'string' },
        success: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'User with email already exists' })
  async startOnboarding(@Body() data: OnboardingStartDto) {
    this.logger.log(`Starting onboarding for ${data.user.email}`);
    
    const result = await this.onboardingService.startOnboarding(data);
    
    return {
      data: result,
      message: 'Onboarding started successfully',
      success: true,
    };
  }

  @Post('members')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add household member',
    description: 'Add a new member to the household during onboarding',
  })
  @ApiBody({ type: OnboardingMemberDto })
  @ApiResponse({
    status: 201,
    description: 'Member added successfully',
    schema: {
      type: 'object',
      properties: {
        data: { $ref: '#/components/schemas/User' },
        message: { type: 'string' },
        success: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid member data' })
  @ApiResponse({ status: 404, description: 'Current user not found' })
  @ApiResponse({ status: 409, description: 'Member already exists in household' })
  async addMember(
    @Request() req: any,
    @Body() memberData: OnboardingMemberDto,
  ) {
    this.logger.log(`Adding member ${memberData.email} to household`);
    
    const member = await this.onboardingService.addMember(req.user.id, memberData);
    
    return {
      data: member,
      message: 'Member added successfully',
      success: true,
    };
  }

  @Post('roles')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign roles to users',
    description: 'Assign roles to household members during onboarding',
  })
  @ApiBody({ type: OnboardingRolesDto })
  @ApiResponse({
    status: 200,
    description: 'Roles assigned successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            updated: { type: 'number' },
          },
        },
        message: { type: 'string' },
        success: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid role assignments' })
  async assignRoles(
    @Request() req: any,
    @Body() rolesData: OnboardingRolesDto,
  ) {
    this.logger.log(`Assigning roles for ${rolesData.assignments.length} users`);
    
    const result = await this.onboardingService.assignRoles(req.user.id, rolesData);
    
    return {
      data: result,
      message: 'Roles assigned successfully',
      success: true,
    };
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get onboarding status',
    description: 'Retrieve current onboarding progress for the user',
  })
  @ApiResponse({
    status: 200,
    description: 'Onboarding status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            status: { $ref: '#/components/schemas/OnboardingStatusDto' },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  step: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  required: { type: 'boolean' },
                  order: { type: 'number' },
                },
              },
            },
          },
        },
        message: { type: 'string' },
        success: { type: 'boolean' },
      },
    },
  })
  async getStatus(@Request() req: any) {
    this.logger.log(`Getting onboarding status for user ${req.user.id}`);
    
    const status = await this.onboardingService.getOnboardingStatus(req.user.id);
    const steps = this.onboardingService.getOnboardingSteps();
    
    return {
      data: {
        status,
        steps,
      },
      message: 'Onboarding status retrieved successfully',
      success: true,
    };
  }

  @Post('complete')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete onboarding',
    description: 'Mark the onboarding process as complete',
  })
  @ApiResponse({
    status: 200,
    description: 'Onboarding completed successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        message: { type: 'string' },
        success: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Cannot complete onboarding - missing required steps' })
  async completeOnboarding(@Request() req: any) {
    this.logger.log(`Completing onboarding for user ${req.user.id}`);
    
    const result = await this.onboardingService.completeOnboarding(req.user.id);
    
    return {
      data: result,
      message: 'Onboarding completed successfully',
      success: true,
    };
  }
}
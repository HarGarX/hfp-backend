import { Injectable, Logger, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnboardingStatus } from './entities/onboarding-status.entity';
import { User } from '../users/entities/user.entity';
import { Household } from '../households/entities/household.entity';
import { UsersService } from '../users/users.service';
import { HouseholdsService } from '../households/households.service';
import { 
  OnboardingStartDto, 
  OnboardingMemberDto, 
  OnboardingRolesDto,
  OnboardingStatusDto 
} from './dto/onboarding.dto';

export interface OnboardingStep {
  step: string;
  title: string;
  description: string;
  required: boolean;
  order: number;
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  private readonly ONBOARDING_STEPS: OnboardingStep[] = [
    {
      step: 'welcome',
      title: 'Welcome',
      description: 'Welcome to HFP - Household Financial Platform',
      required: true,
      order: 1,
    },
    {
      step: 'household_info',
      title: 'Household Information',
      description: 'Set up your household details',
      required: true,
      order: 2,
    },
    {
      step: 'members_roles',
      title: 'Members & Roles',
      description: 'Add household members and assign roles',
      required: false,
      order: 3,
    },
    {
      step: 'summary',
      title: 'Summary',
      description: 'Review and confirm your setup',
      required: true,
      order: 4,
    },
  ];

  constructor(
    @InjectRepository(OnboardingStatus)
    private onboardingStatusRepository: Repository<OnboardingStatus>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Household)
    private householdRepository: Repository<Household>,
    private usersService: UsersService,
    private householdsService: HouseholdsService,
  ) {}

  /**
   * Start the onboarding process by creating household and initial user
   */
  async startOnboarding(data: OnboardingStartDto): Promise<{ household: Household; user: User }> {
    this.logger.log('Starting onboarding process');

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: data.user.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Create household
    const household = await this.householdsService.create({
      name: data.household.name,
      description: 'Created via onboarding',
      status: 'ACTIVE' as any,
      default_currency: data.household.default_currency,
      address: `${data.household.address || ''}, ${data.household.city || ''}, ${data.household.state || ''} ${data.household.zip_code || ''}`.trim(),
    });

    // Create initial user as household admin
    const user = await this.usersService.create({
      email: data.user.email,
      first_name: data.user.first_name,
      last_name: data.user.last_name,
      role: 'ADMIN' as any, // Will be household admin
      household_id: household.id,
      is_active: true,
    });

    // Initialize onboarding status
    await this.initializeOnboardingStatus(user.id);

    // Mark welcome step as completed
    await this.updateOnboardingStep(user.id, 'welcome', true, {
      household_created: true,
      user_created: true,
    });

    this.logger.log(`Onboarding started for user ${user.email} in household ${household.name}`);
    
    return { household, user };
  }

  /**
   * Add a member to the household during onboarding
   */
  async addMember(userId: string, memberData: OnboardingMemberDto): Promise<User> {
    this.logger.log(`Adding member ${memberData.email} to household`);

    // Get the current user to find household
    const currentUser = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['household'],
    });

    if (!currentUser) {
      throw new NotFoundException('Current user not found');
    }

    // Check if member already exists in household
    const existingMember = await this.userRepository.findOne({
      where: { 
        email: memberData.email,
        household_id: currentUser.household_id,
      },
    });

    if (existingMember) {
      throw new ConflictException('Member with this email already exists in household');
    }

    // Create new member
    const member = await this.usersService.create({
      email: memberData.email,
      first_name: memberData.first_name,
      last_name: memberData.last_name,
      role: memberData.role as any,
      household_id: currentUser.household_id,
      is_active: true,
    });

    // Update household member count
    await this.householdRepository.increment(
      { id: currentUser.household_id },
      'member_count',
      1
    );

    // Update onboarding progress
    const onboardingStatus = await this.getOnboardingStatus(userId);
    const memberData_saved = onboardingStatus?.data?.members || [];
    memberData_saved.push({
      id: member.id,
      email: member.email,
      name: `${member.first_name} ${member.last_name}`,
      role: member.role,
    });

    await this.updateOnboardingStep(userId, 'members_roles', false, {
      ...onboardingStatus?.data,
      members: memberData_saved,
    });

    this.logger.log(`Member ${member.email} added to household`);
    return member;
  }

  /**
   * Assign roles to users during onboarding
   */
  async assignRoles(userId: string, rolesData: OnboardingRolesDto): Promise<{ updated: number }> {
    this.logger.log(`Assigning roles for ${rolesData.assignments.length} users`);

    let updated = 0;
    for (const assignment of rolesData.assignments) {
      try {
        await this.usersService.update(assignment.userId, {
          role: assignment.role as any,
        });
        updated++;
      } catch (error) {
        this.logger.error(`Failed to update role for user ${assignment.userId}: ${error.message}`);
      }
    }

    // Update onboarding progress
    await this.updateOnboardingStep(userId, 'members_roles', true, {
      roles_assigned: rolesData.assignments,
      assignment_count: updated,
    });

    this.logger.log(`Updated roles for ${updated} users`);
    return { updated };
  }

  /**
   * Get current onboarding status for a user
   */
  async getOnboardingStatus(userId: string): Promise<OnboardingStatusDto | null> {
    const status = await this.onboardingStatusRepository.findOne({
      where: { user_id: userId },
      order: { updated_at: 'DESC' },
    });

    if (!status) {
      return null;
    }

    return {
      step: status.step,
      completed: status.completed,
      data: status.data,
    };
  }

  /**
   * Get all onboarding steps
   */
  getOnboardingSteps(): OnboardingStep[] {
    return this.ONBOARDING_STEPS;
  }

  /**
   * Complete the onboarding process
   */
  async completeOnboarding(userId: string): Promise<{ success: boolean }> {
    this.logger.log(`Completing onboarding for user ${userId}`);

    // Validate all required steps are completed
    const requiredSteps = this.ONBOARDING_STEPS.filter(step => step.required);
    const completedSteps = await this.onboardingStatusRepository.find({
      where: { 
        user_id: userId,
        completed: true,
      },
    });

    const completedStepNames = completedSteps.map(s => s.step);
    const missingSteps = requiredSteps.filter(step => 
      !completedStepNames.includes(step.step)
    );

    if (missingSteps.length > 0) {
      throw new BadRequestException(
        `Cannot complete onboarding. Missing required steps: ${missingSteps.map(s => s.title).join(', ')}`
      );
    }

    // Mark summary step as completed
    await this.updateOnboardingStep(userId, 'summary', true, {
      completed_at: new Date().toISOString(),
      all_steps_completed: true,
    });

    // Update user to mark onboarding as completed
    await this.userRepository.update(userId, {
      // Add an onboarding_completed field if needed
    });

    this.logger.log(`Onboarding completed for user ${userId}`);
    return { success: true };
  }

  /**
   * Initialize onboarding status for a new user
   */
  private async initializeOnboardingStatus(userId: string): Promise<void> {
    for (const step of this.ONBOARDING_STEPS) {
      const status = this.onboardingStatusRepository.create({
        user_id: userId,
        step: step.step,
        completed: false,
        data: {
          title: step.title,
          description: step.description,
          required: step.required,
          order: step.order,
        },
      });
      await this.onboardingStatusRepository.save(status);
    }
  }

  /**
   * Update a specific onboarding step
   */
  private async updateOnboardingStep(
    userId: string, 
    step: string, 
    completed: boolean, 
    data?: Record<string, any>
  ): Promise<void> {
    let status = await this.onboardingStatusRepository.findOne({
      where: { user_id: userId, step },
    });

    if (!status) {
      status = this.onboardingStatusRepository.create({
        user_id: userId,
        step,
        completed,
        data,
      });
    } else {
      status.completed = completed;
      status.data = { ...status.data, ...data };
    }

    await this.onboardingStatusRepository.save(status);
  }
}
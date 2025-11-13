import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { Household, HouseholdStatus } from '../households/entities/household.entity';
import { KeycloakJwtPayload } from './strategies/keycloak.strategy';
import { KeycloakService } from './keycloak.service';

@Injectable()
export class UserSyncService {
  private readonly logger = new Logger(UserSyncService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Household)
    private householdRepository: Repository<Household>,
    private keycloakService: KeycloakService,
  ) {}

  async syncUserFromKeycloak(keycloakPayload: KeycloakJwtPayload): Promise<User> {
    this.logger.log(`Syncing user from Keycloak: ${keycloakPayload.sub}`);

    // Check if user already exists
    let user = await this.userRepository.findOne({
      where: { keycloak_id: keycloakPayload.sub },
      relations: ['household'],
    });

    if (user) {
      // Update existing user
      user = await this.updateExistingUser(user, keycloakPayload);
    } else {
      // Create new user
      user = await this.createNewUser(keycloakPayload);
    }

    return user;
  }

  private async updateExistingUser(user: User, payload: KeycloakJwtPayload): Promise<User> {
    // Update user fields from Keycloak
    user.email = payload.email;
    user.first_name = payload.given_name || user.first_name;
    user.last_name = payload.family_name || user.last_name;
    
    // Update role if specified in token
    if (payload.hfp_role) {
      user.role = this.mapKeycloakRoleToUserRole(payload.hfp_role);
    }

    // Handle household change
    if (payload.household_id && payload.household_id !== user.household_id) {
      const household = await this.ensureHouseholdExists(payload.household_id);
      user.household_id = household.id;
      user.household = household;
    }

    return this.userRepository.save(user);
  }

  private async createNewUser(payload: KeycloakJwtPayload): Promise<User> {
    // Ensure household exists or create default
    const householdId = payload.household_id || 'default';
    const household = await this.ensureHouseholdExists(householdId);

    const user = this.userRepository.create({
      keycloak_id: payload.sub,
      email: payload.email,
      first_name: payload.given_name || '',
      last_name: payload.family_name || '',
      role: this.mapKeycloakRoleToUserRole(payload.hfp_role || 'member'),
      household_id: household.id,
      is_active: true,
      // Don't set password_hash for Keycloak users
      password_hash: '', 
    });

    this.logger.log(`Creating new user: ${user.email} for household: ${household.name}`);
    return this.userRepository.save(user);
  }

  private async ensureHouseholdExists(householdIdentifier: string): Promise<Household> {
    let household = await this.householdRepository.findOne({
      where: [
        { id: householdIdentifier },
        { name: householdIdentifier },
      ],
    });

    if (!household) {
      // Create default household
      household = this.householdRepository.create({
        name: householdIdentifier === 'default' ? 'Default Household' : householdIdentifier,
        description: 'Automatically created household',
        status: HouseholdStatus.ACTIVE,
        default_currency: 'USD',
        member_count: 0,
        total_income: 0,
        total_expenses: 0,
      });

      household = await this.householdRepository.save(household);
      this.logger.log(`Created new household: ${household.name}`);
    }

    return household;
  }

  private mapKeycloakRoleToUserRole(keycloakRole: string): UserRole {
    const roleMapping: Record<string, UserRole> = {
      // Keycloak realm roles to HFP roles
      'system-admin': UserRole.ADMIN,
      'household-admin': UserRole.ADMIN,
      'household-member': UserRole.MEMBER,
      'household-viewer': UserRole.VIEWER,
      'hfp-user': UserRole.MEMBER,
      // Legacy mappings
      'hfp_admin': UserRole.ADMIN,
      'hfp_member': UserRole.MEMBER,
      'hfp_viewer': UserRole.VIEWER,
      'admin': UserRole.ADMIN,
      'member': UserRole.MEMBER,
      'viewer': UserRole.VIEWER,
    };

    return roleMapping[keycloakRole] || UserRole.MEMBER;
  }

  async getUserByKeycloakId(keycloakId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { keycloak_id: keycloakId },
      relations: ['household'],
    });
  }
}
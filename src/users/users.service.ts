import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { UserRepository, UserQueryOptions, PaginatedUsers } from './repositories/user.repository';
import { User, UserRole } from './entities/user.entity';
import { TenantContextService } from '../../libs/tenant';
import * as bcrypt from 'bcrypt';

export interface CreateUserDto {
  email: string;
  first_name: string;
  last_name: string;
  password?: string;
  role?: UserRole;
  is_active?: boolean;
  household_id?: string;
}

export interface UpdateUserDto {
  first_name?: string;
  last_name?: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { email, password, household_id, ...userData } = createUserDto;

    // Check if email already exists
    const emailUnique = await this.userRepository.isEmailUnique(email);
    if (!emailUnique) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password if provided
    let password_hash: string | undefined;
    if (password) {
      const saltRounds = 12;
      password_hash = await bcrypt.hash(password, saltRounds);
    }

    // Use tenant context household_id if not provided
    const tenantId = household_id || this.tenantContextService.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException('Household context is required to create users');
    }

    const userToCreate: Partial<User> = {
      email,
      password_hash,
      household_id: tenantId,
      role: createUserDto.role || UserRole.MEMBER,
      is_active: createUserDto.is_active !== undefined ? createUserDto.is_active : true,
      ...userData,
    };

    return this.userRepository.create(userToCreate as any);
  }

  async findAll(options: UserQueryOptions = {}): Promise<PaginatedUsers> {
    return this.userRepository.findAllPaginated(options);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async findByKeycloakId(keycloakId: string): Promise<User | null> {
    return this.userRepository.findByKeycloakId(keycloakId);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    // Verify user exists and belongs to current tenant
    const existingUser = await this.findOne(id);

    const updatedUser = await this.userRepository.updateUser(id, updateUserDto);
    if (!updatedUser) {
      throw new NotFoundException('User not found or access denied');
    }

    return updatedUser;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);

    // Prevent deleting the last admin user
    if (user.role === UserRole.ADMIN || user.role === UserRole.HOUSEHOLD_ADMIN) {
      const adminUsers = await this.userRepository.findByRole(user.role);
      if (adminUsers.length <= 1) {
        throw new ConflictException(`Cannot delete the last ${user.role} user`);
      }
    }

    const deleted = await this.userRepository.softDelete(id);
    if (!deleted) {
      throw new ForbiddenException('Access denied or user not found');
    }
  }

  async activate(id: string): Promise<User> {
    const activated = await this.userRepository.activateUser(id);
    if (!activated) {
      throw new NotFoundException('User not found or access denied');
    }
    return this.findOne(id);
  }

  async deactivate(id: string): Promise<User> {
    const user = await this.findOne(id);

    // Prevent deactivating the last admin user
    if (user.role === UserRole.ADMIN || user.role === UserRole.HOUSEHOLD_ADMIN) {
      const activeAdmins = await this.userRepository.find({
        where: { 
          role: user.role,
          is_active: true,
        }
      });

      if (activeAdmins.length <= 1) {
        throw new ConflictException(`Cannot deactivate the last active ${user.role} user`);
      }
    }

    const deactivated = await this.userRepository.deactivateUser(id);
    if (!deactivated) {
      throw new NotFoundException('User not found or access denied');
    }

    return this.findOne(id);
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    if (user.password_hash) {
      const isCurrentPasswordValid = await bcrypt.compare(
        changePasswordDto.currentPassword,
        user.password_hash
      );

      if (!isCurrentPasswordValid) {
        throw new ForbiddenException('Current password is incorrect');
      }
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(changePasswordDto.newPassword, saltRounds);

    await this.userRepository.updateUser(userId, {
      password_hash: newPasswordHash,
    });
  }

  async getUsersByRole(role: UserRole): Promise<User[]> {
    return this.userRepository.findByRole(role);
  }

  async getActiveUsers(): Promise<User[]> {
    return this.userRepository.findActiveUsers();
  }

  async getUserStatistics() {
    return this.userRepository.getUserStatistics();
  }

  async promoteToAdmin(userId: string): Promise<User> {
    return this.update(userId, { role: UserRole.HOUSEHOLD_ADMIN });
  }

  async demoteFromAdmin(userId: string): Promise<User> {
    const user = await this.findOne(userId);

    // Prevent demoting the last admin
    if (user.role === UserRole.HOUSEHOLD_ADMIN) {
      const adminUsers = await this.userRepository.findByRole(UserRole.HOUSEHOLD_ADMIN);
      if (adminUsers.length <= 1) {
        throw new ConflictException('Cannot demote the last household admin');
      }
    }

    return this.update(userId, { role: UserRole.MEMBER });
  }

  async assignToHousehold(userId: string, householdId: string): Promise<User> {
    // This method would typically be used by system admins
    // to move users between households
    const tenantId = this.tenantContextService.getTenantId();
    if (tenantId && tenantId !== householdId) {
      throw new ForbiddenException('Cannot assign user to different household');
    }

    const result = await this.userRepository.updateUser(userId, { household_id: householdId });
    if (!result) {
      throw new NotFoundException('User not found or access denied');
    }
    return result;
  }

  async validateCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findByEmail(email);
    if (!user || !user.password_hash || !user.is_active) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    return isPasswordValid ? user : null;
  }
}
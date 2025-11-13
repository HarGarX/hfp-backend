import { Injectable } from '@nestjs/common';
import { Repository, FindManyOptions, Not } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseTenantRepository, TenantContextService } from '../../../libs/tenant';
import { User, UserRole } from '../entities/user.entity';

export interface UserQueryOptions {
  search?: string;
  role?: UserRole;
  is_active?: boolean;
  household_id?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedUsers {
  users: User[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Tenant-aware repository for User entities
 * Extends BaseTenantRepository to automatically filter by household_id
 */
@Injectable()
export class UserRepository extends BaseTenantRepository<User> {
  constructor(
    @InjectRepository(User)
    repository: Repository<User>,
    tenantContextService: TenantContextService,
  ) {
    super(repository, tenantContextService);
  }

  /**
   * Find user by email within tenant scope
   */
  async findByEmail(email: string): Promise<User | null> {
    const tenantId = this.tenantContextService.getTenantId();
    if (!tenantId) {
      // If no tenant context, allow global email search for auth purposes
      return this.repository.findOne({
        where: { email },
        relations: ['household'],
      });
    }

    return this.repository.findOne({
      where: { 
        email,
        household_id: tenantId,
      },
      relations: ['household'],
    });
  }

  /**
   * Find user by Keycloak ID within tenant scope
   */
  async findByKeycloakId(keycloakId: string): Promise<User | null> {
    const tenantId = this.tenantContextService.getTenantId();
    if (!tenantId) {
      return this.repository.findOne({
        where: { keycloak_id: keycloakId },
        relations: ['household'],
      });
    }

    return this.repository.findOne({
      where: { 
        keycloak_id: keycloakId,
        household_id: tenantId,
      },
      relations: ['household'],
    });
  }

  /**
   * Get paginated list of users with tenant filtering
   */
  async findAllPaginated(options: UserQueryOptions): Promise<PaginatedUsers> {
    const { search, role, is_active, page = 1, limit = 10 } = options;
    
    const queryBuilder = this.createTenantQueryBuilder('user')
      .leftJoinAndSelect('user.household', 'household');

    if (search) {
      queryBuilder.andWhere(
        '(user.first_name ILIKE :search OR user.last_name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    if (is_active !== undefined) {
      queryBuilder.andWhere('user.is_active = :is_active', { is_active });
    }

    const total = await queryBuilder.getCount();
    
    const users = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('user.created_at', 'DESC')
      .getMany();

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find all users by role within tenant
   */
  async findByRole(role: UserRole): Promise<User[]> {
    return this.find({
      where: { role },
      relations: ['household'],
    });
  }

  /**
   * Find all active users within tenant
   */
  async findActiveUsers(): Promise<User[]> {
    return this.find({
      where: { is_active: true },
      relations: ['household'],
    });
  }

  /**
   * Get user statistics for tenant
   */
  async getUserStatistics() {
    const tenantId = this.tenantContextService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required for user statistics');
    }

    const queryBuilder = this.repository.createQueryBuilder('user')
      .where('user.household_id = :tenantId', { tenantId });

    const totalUsers = await queryBuilder.getCount();
    
    const activeUsers = await queryBuilder
      .andWhere('user.is_active = true')
      .getCount();

    const usersByRole = await queryBuilder
      .select('user.role, COUNT(*) as count')
      .groupBy('user.role')
      .getRawMany();

    return {
      total: totalUsers,
      active: activeUsers,
      inactive: totalUsers - activeUsers,
      byRole: usersByRole.reduce((acc, item) => {
        acc[item.user_role] = parseInt(item.count);
        return acc;
      }, {} as Record<UserRole, number>),
    };
  }

  /**
   * Check if email is unique within tenant
   */
  async isEmailUnique(email: string, excludeUserId?: string): Promise<boolean> {
    const tenantId = this.tenantContextService.getTenantId();
    if (!tenantId) {
      // Global email check
      const user = await this.repository.findOne({
        where: excludeUserId 
          ? { email, id: Not(excludeUserId) }
          : { email }
      });
      return !user;
    }

    const queryBuilder = this.repository.createQueryBuilder('user')
      .where('user.email = :email', { email })
      .andWhere('user.household_id = :tenantId', { tenantId });

    if (excludeUserId) {
      queryBuilder.andWhere('user.id != :excludeUserId', { excludeUserId });
    }

    const user = await queryBuilder.getOne();
    return !user;
  }

  /**
   * Update user with tenant validation
   */
  async updateUser(id: string, updateData: Partial<User>): Promise<User | null> {
    // First verify the user exists and belongs to current tenant
    const existingUser = await this.findById(id);
    if (!existingUser) {
      return null;
    }

    await this.repository.update({ id }, {
      ...updateData,
      updated_at: new Date(),
    });

    return this.findById(id);
  }

  /**
   * Deactivate user (soft disable)
   */
  async deactivateUser(id: string): Promise<boolean> {
    const result = await this.updateUser(id, { is_active: false });
    return !!result;
  }

  /**
   * Activate user
   */
  async activateUser(id: string): Promise<boolean> {
    const result = await this.updateUser(id, { is_active: true });
    return !!result;
  }
}
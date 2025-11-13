import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantContextService } from '../../../libs/tenant';
import { Household, HouseholdStatus } from '../entities/household.entity';

export interface HouseholdQueryOptions {
  search?: string;
  status?: HouseholdStatus;
  page?: number;
  limit?: number;
}

export interface PaginatedHouseholds {
  households: Household[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Tenant-aware repository for Household entities
 * 
 * Note: Households ARE the tenant entities in this system,
 * so this repository handles tenant-level operations differently
 * than other entities that extend HouseholdScopedEntity
 */
@Injectable()
export class HouseholdRepository {
  constructor(
    @InjectRepository(Household)
    private readonly repository: Repository<Household>,
    private readonly tenantContextService: TenantContextService,
  ) {}

  /**
   * Find household by ID with tenant validation
   * Since households are tenants themselves, we validate the tenant context
   */
  async findById(id: string): Promise<Household | null> {
    const tenantId = this.tenantContextService.getTenantId();
    
    // If tenant context is provided, it must match the household ID
    if (tenantId && tenantId !== id) {
      return null; // User cannot access households outside their tenant
    }

    return this.repository.findOne({
      where: { id },
      relations: ['users'],
    });
  }

  /**
   * Create a new household
   */
  async create(householdData: Partial<Household>): Promise<Household> {
    const household = this.repository.create(householdData);
    return this.repository.save(household);
  }

  /**
   * Update household with tenant validation
   */
  async update(id: string, updateData: Partial<Household>): Promise<Household | null> {
    const tenantId = this.tenantContextService.getTenantId();
    
    // Validate tenant access
    if (tenantId && tenantId !== id) {
      return null;
    }

    // Verify household exists first
    const household = await this.findById(id);
    if (!household) {
      return null;
    }

    await this.repository.update(id, {
      ...updateData,
      updated_at: new Date(),
    });

    return this.findById(id);
  }

  /**
   * Soft delete household with tenant validation
   */
  async softDelete(id: string): Promise<boolean> {
    const tenantId = this.tenantContextService.getTenantId();
    
    // Validate tenant access
    if (tenantId && tenantId !== id) {
      return false;
    }

    const result = await this.repository.softDelete(id);
    return (result.affected || 0) > 0;
  }

  /**
   * Find household by name (for uniqueness checks)
   */
  async findByName(name: string): Promise<Household | null> {
    return this.repository.findOne({
      where: { name },
    });
  }

  /**
   * Get paginated list of households (admin only - no tenant filtering)
   * This is for system administrators to view all households
   */
  async findAllPaginated(options: HouseholdQueryOptions): Promise<PaginatedHouseholds> {
    const { search, status, page = 1, limit = 10 } = options;
    
    const queryBuilder = this.repository.createQueryBuilder('household')
      .leftJoinAndSelect('household.users', 'users');

    if (search) {
      queryBuilder.where(
        'household.name ILIKE :search OR household.description ILIKE :search',
        { search: `%${search}%` }
      );
    }

    if (status) {
      queryBuilder.andWhere('household.status = :status', { status });
    }

    const total = await queryBuilder.getCount();
    
    const households = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('household.created_at', 'DESC')
      .getMany();

    return {
      households,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get household statistics for admin dashboard
   */
  async getStatistics() {
    const totalCount = await this.repository.count();
    const activeCount = await this.repository.count({
      where: { status: HouseholdStatus.ACTIVE }
    });
    const inactiveCount = await this.repository.count({
      where: { status: HouseholdStatus.INACTIVE }
    });
    const suspendedCount = await this.repository.count({
      where: { status: HouseholdStatus.SUSPENDED }
    });

    return {
      total: totalCount,
      active: activeCount,
      inactive: inactiveCount,
      suspended: suspendedCount,
    };
  }

  /**
   * Update household member count
   */
  async updateMemberCount(householdId: string): Promise<void> {
    const count = await this.repository
      .createQueryBuilder('household')
      .leftJoin('household.users', 'user')
      .where('household.id = :householdId', { householdId })
      .andWhere('user.deleted_at IS NULL')
      .getCount();

    await this.repository.update(householdId, { 
      member_count: count,
      updated_at: new Date(),
    });
  }
}
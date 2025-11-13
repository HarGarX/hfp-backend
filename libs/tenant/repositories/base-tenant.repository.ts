import { Repository, SelectQueryBuilder, FindManyOptions, FindOneOptions } from 'typeorm';
import { TenantContextService } from '../services/tenant-context.service';
import { Injectable } from '@nestjs/common';

/**
 * Base repository that automatically adds tenant filtering to all queries
 * Extends TypeORM Repository with tenant isolation
 */
@Injectable()
export abstract class BaseTenantRepository<T extends { household_id: string }> {
  protected constructor(
    protected readonly repository: Repository<T>,
    protected readonly tenantContextService: TenantContextService,
  ) {}

  /**
   * Find entities with automatic tenant filtering
   */
  async find(options?: FindManyOptions<T>): Promise<T[]> {
    const tenantId = this.tenantContextService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required for database operations');
    }

    return this.repository.find({
      ...options,
      where: {
        ...options?.where,
        household_id: tenantId,
      } as any,
    });
  }

  /**
   * Find one entity with automatic tenant filtering
   */
  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    const tenantId = this.tenantContextService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required for database operations');
    }

    return this.repository.findOne({
      ...options,
      where: {
        ...options?.where,
        household_id: tenantId,
      } as any,
    });
  }

  /**
   * Find entity by ID with automatic tenant filtering
   */
  async findById(id: string): Promise<T | null> {
    const tenantId = this.tenantContextService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required for database operations');
    }

    return this.repository.findOne({
      where: {
        id,
        household_id: tenantId,
      } as any,
    });
  }

  /**
   * Create and save entity with automatic tenant assignment
   */
  async create(entityData: Omit<T, 'id' | 'household_id' | 'created_at' | 'updated_at'>): Promise<T> {
    const tenantId = this.tenantContextService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required for database operations');
    }

    const entity = this.repository.create({
      ...entityData,
      household_id: tenantId,
    } as any);

    const savedEntity = await this.repository.save(entity);
    return Array.isArray(savedEntity) ? savedEntity[0] : savedEntity;
  }

  /**
   * Update entity with tenant validation
   */
  async update(id: string, updateData: Partial<Omit<T, 'id' | 'household_id' | 'created_at'>>): Promise<T | null> {
    const tenantId = this.tenantContextService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required for database operations');
    }

    // First verify the entity belongs to the current tenant
    const existingEntity = await this.findById(id);
    if (!existingEntity) {
      return null;
    }

    await this.repository.update(
      { id, household_id: tenantId } as any,
      { ...updateData, updated_at: new Date() } as any
    );

    return this.findById(id);
  }

  /**
   * Delete entity with tenant validation
   */
  async delete(id: string): Promise<boolean> {
    const tenantId = this.tenantContextService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required for database operations');
    }

    // First verify the entity belongs to the current tenant
    const existingEntity = await this.findById(id);
    if (!existingEntity) {
      return false;
    }

    const result = await this.repository.delete({ id, household_id: tenantId } as any);
    return (result.affected || 0) > 0;
  }

  /**
   * Soft delete entity with tenant validation
   */
  async softDelete(id: string): Promise<boolean> {
    const tenantId = this.tenantContextService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required for database operations');
    }

    // First verify the entity belongs to the current tenant
    const existingEntity = await this.findById(id);
    if (!existingEntity) {
      return false;
    }

    const result = await this.repository.softDelete({ id, household_id: tenantId } as any);
    return (result.affected || 0) > 0;
  }

  /**
   * Create query builder with automatic tenant filtering
   */
  createTenantQueryBuilder(alias: string): SelectQueryBuilder<T> {
    const tenantId = this.tenantContextService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required for database operations');
    }

    return this.repository
      .createQueryBuilder(alias)
      .where(`${alias}.household_id = :tenantId`, { tenantId });
  }

  /**
   * Count entities with automatic tenant filtering
   */
  async count(options?: FindManyOptions<T>): Promise<number> {
    const tenantId = this.tenantContextService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required for database operations');
    }

    return this.repository.count({
      ...options,
      where: {
        ...options?.where,
        household_id: tenantId,
      } as any,
    });
  }
}
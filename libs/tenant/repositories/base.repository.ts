import {
  Repository,
  FindOptionsWhere,
  FindManyOptions,
  FindOneOptions,
  DeepPartial,
  SaveOptions,
  RemoveOptions,
  ObjectLiteral,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { HouseholdScopedEntity } from '../../../src/shared/entities/base.entity';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

/**
 * Base Repository with automatic tenant (household) filtering
 * Ensures all database queries are scoped to the current household
 * Prevents data leakage across tenants
 */
export class BaseRepository<
  T extends HouseholdScopedEntity,
> extends Repository<T> {
  /**
   * Get current household ID from context
   * This should be set by TenantInterceptor from request headers
   */
  private getHouseholdId(): string | null {
    // In a real implementation, this would get the ID from async local storage
    // or request context. For now, we'll require it to be passed explicitly.
    return null;
  }

  /**
   * Validate and inject household_id into where conditions
   */
  private injectHouseholdFilter(
    householdId: string,
    options?: FindManyOptions<T> | FindOneOptions<T>,
  ): FindManyOptions<T> | FindOneOptions<T> {
    if (!householdId) {
      throw new BadRequestException(
        'Household context is required but not found',
      );
    }

    const where = options?.where || {};

    // If where is an array, inject household_id into each condition
    if (Array.isArray(where)) {
      return {
        ...options,
        where: where.map((condition) => ({
          ...condition,
          household_id: householdId,
        })),
      } as FindManyOptions<T>;
    }

    // Single where condition
    return {
      ...options,
      where: {
        ...where,
        household_id: householdId,
      } as FindOptionsWhere<T>,
    } as FindManyOptions<T>;
  }

  /**
   * Validate entity belongs to household
   */
  private validateHouseholdAccess(
    entity: T | T[],
    householdId: string,
  ): void {
    if (!householdId) {
      throw new BadRequestException('Household context is required');
    }

    const entities = Array.isArray(entity) ? entity : [entity];

    for (const e of entities) {
      if (e.household_id && e.household_id !== householdId) {
        throw new ForbiddenException(
          'Access denied: Resource belongs to different household',
        );
      }
    }
  }

  /**
   * Find entities with automatic household filtering
   */
  async findWithHousehold(
    householdId: string,
    options?: FindManyOptions<T>,
  ): Promise<T[]> {
    const filteredOptions = this.injectHouseholdFilter(householdId, options);
    return this.find(filteredOptions);
  }

  /**
   * Find one entity with automatic household filtering
   */
  async findOneWithHousehold(
    householdId: string,
    options: FindOneOptions<T>,
  ): Promise<T | null> {
    const filteredOptions = this.injectHouseholdFilter(householdId, options);
    return this.findOne(filteredOptions);
  }

  /**
   * Find by ID with household validation
   */
  async findByIdWithHousehold(
    householdId: string,
    id: string,
  ): Promise<T | null> {
    return this.findOneWithHousehold(householdId, {
      where: { id } as FindOptionsWhere<T>,
    });
  }

  /**
   * Count entities with automatic household filtering
   */
  async countWithHousehold(
    householdId: string,
    options?: FindManyOptions<T>,
  ): Promise<number> {
    const filteredOptions = this.injectHouseholdFilter(householdId, options);
    return this.count(filteredOptions);
  }

  /**
   * Save entity with household validation
   */
  async saveWithHousehold(
    householdId: string,
    entity: DeepPartial<T>,
    options?: SaveOptions,
  ): Promise<T>;
  async saveWithHousehold(
    householdId: string,
    entity: DeepPartial<T>[],
    options?: SaveOptions,
  ): Promise<T[]>;
  async saveWithHousehold(
    householdId: string,
    entity: DeepPartial<T> | DeepPartial<T>[],
    options?: SaveOptions,
  ): Promise<T | T[]> {
    const entities = Array.isArray(entity) ? entity : [entity];

    // Inject household_id if not present
    const entitiesWithHousehold = entities.map((e) => ({
      ...e,
      household_id: e.household_id || householdId,
    }));

    // Validate all entities belong to the household
    this.validateHouseholdAccess(
      entitiesWithHousehold as T[],
      householdId,
    );

    const result = await this.save(
      entitiesWithHousehold as DeepPartial<T>[],
      options,
    );

    return Array.isArray(entity) ? result : result[0];
  }

  /**
   * Update entity with household validation
   */
  async updateWithHousehold(
    householdId: string,
    criteria: string | string[] | FindOptionsWhere<T>,
    partialEntity: QueryDeepPartialEntity<T>,
  ): Promise<void> {
    // If criteria is an ID or array of IDs, convert to where condition
    let where: FindOptionsWhere<T>;

    if (typeof criteria === 'string') {
      where = { id: criteria, household_id: householdId } as FindOptionsWhere<T>;
    } else if (Array.isArray(criteria)) {
      // For multiple IDs, we need to update one by one or use IN clause
      // For simplicity, validate each exists in household first
      for (const id of criteria) {
        const entity = await this.findByIdWithHousehold(householdId, id);
        if (!entity) {
          throw new ForbiddenException(
            `Entity with ID ${id} not found in household`,
          );
        }
      }
      where = { id: criteria as any, household_id: householdId } as FindOptionsWhere<T>;
    } else {
      where = { ...criteria, household_id: householdId };
    }

    await this.update(where, partialEntity);
  }

  /**
   * Delete entity with household validation (soft delete)
   */
  async deleteWithHousehold(
    householdId: string,
    criteria: string | string[] | FindOptionsWhere<T>,
  ): Promise<void> {
    // If criteria is an ID or array of IDs, validate access first
    if (typeof criteria === 'string') {
      const entity = await this.findByIdWithHousehold(householdId, criteria);
      if (!entity) {
        throw new ForbiddenException('Entity not found in household');
      }
    } else if (Array.isArray(criteria)) {
      for (const id of criteria) {
        const entity = await this.findByIdWithHousehold(householdId, id);
        if (!entity) {
          throw new ForbiddenException(
            `Entity with ID ${id} not found in household`,
          );
        }
      }
    }

    let where: FindOptionsWhere<T>;
    if (typeof criteria === 'string') {
      where = { id: criteria, household_id: householdId } as FindOptionsWhere<T>;
    } else if (Array.isArray(criteria)) {
      where = { id: criteria as any, household_id: householdId } as FindOptionsWhere<T>;
    } else {
      where = { ...criteria, household_id: householdId };
    }

    // Use soft delete
    await this.softDelete(where);
  }

  /**
   * Remove entity with household validation (hard delete)
   */
  async removeWithHousehold(
    householdId: string,
    entity: T | T[],
    options?: RemoveOptions,
  ): Promise<T | T[]> {
    this.validateHouseholdAccess(entity, householdId);
    
    if (Array.isArray(entity)) {
      return this.remove(entity, options);
    } else {
      return this.remove(entity, options);
    }
  }

  /**
   * Create query builder with automatic household filtering
   */
  createQueryBuilderWithHousehold(
    householdId: string,
    alias?: string,
  ) {
    if (!householdId) {
      throw new BadRequestException('Household context is required');
    }

    const qb = this.createQueryBuilder(alias);
    qb.andWhere(`${alias || this.metadata.tableName}.household_id = :householdId`, {
      householdId,
    });

    return qb;
  }

  /**
   * Find with pagination and automatic household filtering
   */
  async findWithPagination(
    householdId: string,
    options: FindManyOptions<T> & { page?: number; limit?: number },
  ): Promise<{ data: T[]; total: number; page: number; limit: number }> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    const filteredOptions = this.injectHouseholdFilter(householdId, {
      ...options,
      skip,
      take: limit,
    });

    const [data, total] = await this.findAndCount(filteredOptions);

    return {
      data,
      total,
      page,
      limit,
    };
  }
}

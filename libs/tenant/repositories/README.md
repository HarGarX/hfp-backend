# Multi-Tenant BaseRepository

## Overview
The `BaseRepository` provides automatic tenant (household) filtering for all database operations, ensuring complete data isolation between households.

## Features
- ✅ Automatic `household_id` filtering on all queries
- ✅ Prevents cross-household data access
- ✅ Validates entities belong to correct household
- ✅ Supports pagination with tenant filtering
- ✅ Query builder with automatic filtering
- ✅ Comprehensive error handling

## Usage

### Basic Setup

```typescript
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from '@libs/tenant';
import { YourEntity } from './entities/your.entity';

@Injectable()
export class YourService {
  private repository: BaseRepository<YourEntity>;

  constructor(private dataSource: DataSource) {
    this.repository = new BaseRepository(
      YourEntity,
      dataSource.createEntityManager(),
    );
  }
}
```

### Find Operations

```typescript
// Find all entities for household
const entities = await this.repository.findWithHousehold(householdId);

// Find with options
const entities = await this.repository.findWithHousehold(householdId, {
  where: { status: 'ACTIVE' },
  order: { created_at: 'DESC' },
});

// Find one entity
const entity = await this.repository.findOneWithHousehold(householdId, {
  where: { id: entityId },
});

// Find by ID
const entity = await this.repository.findByIdWithHousehold(
  householdId,
  entityId,
);

// Count entities
const count = await this.repository.countWithHousehold(householdId, {
  where: { status: 'ACTIVE' },
});
```

### Create/Update Operations

```typescript
// Create new entity
const newEntity = await this.repository.saveWithHousehold(householdId, {
  name: 'New Entity',
  // household_id will be injected automatically
});

// Update entity
await this.repository.updateWithHousehold(
  householdId,
  entityId,
  { name: 'Updated Name' },
);

// Save existing entity
const entity = await this.repository.findByIdWithHousehold(
  householdId,
  entityId,
);
entity.name = 'Modified';
await this.repository.saveWithHousehold(householdId, entity);
```

### Delete Operations

```typescript
// Soft delete (sets deleted_at)
await this.repository.deleteWithHousehold(householdId, entityId);

// Hard delete (removes from database)
const entity = await this.repository.findByIdWithHousehold(
  householdId,
  entityId,
);
await this.repository.removeWithHousehold(householdId, entity);
```

### Pagination

```typescript
const result = await this.repository.findWithPagination(householdId, {
  page: 1,
  limit: 10,
  where: { status: 'ACTIVE' },
  order: { created_at: 'DESC' },
});

// Returns:
// {
//   data: T[],
//   total: number,
//   page: number,
//   limit: number
// }
```

### Query Builder

```typescript
const qb = this.repository.createQueryBuilderWithHousehold(
  householdId,
  'entity',
);

const entities = await qb
  .where('entity.status = :status', { status: 'ACTIVE' })
  .orderBy('entity.created_at', 'DESC')
  .getMany();
```

## Security Features

### Automatic Filtering
All queries are automatically filtered by `household_id`. You cannot accidentally query data from other households.

### Validation
- Throws `BadRequestException` if household context is missing
- Throws `ForbiddenException` if attempting to access another household's data
- Validates entities on save/update/delete operations

### Examples of Protected Operations

```typescript
// ❌ This will throw ForbiddenException
const entity = { id: '123', household_id: 'other-household' };
await repository.saveWithHousehold('my-household', entity);
// Error: Access denied: Resource belongs to different household

// ❌ This will return null or throw
const entity = await repository.findByIdWithHousehold(
  'my-household',
  'entity-from-other-household',
);
// Returns: null (entity not found in this household)

// ✅ This works correctly
const entity = await repository.findByIdWithHousehold(
  'my-household',
  'my-entity-id',
);
```

## Migration Guide

### Before (Manual Filtering)

```typescript
async findAll(householdId: string) {
  return this.repository.find({
    where: { household_id: householdId },
  });
}

async findOne(id: string, householdId: string) {
  return this.repository.findOne({
    where: { id, household_id: householdId },
  });
}

async create(dto: CreateDto, householdId: string) {
  const entity = this.repository.create({
    ...dto,
    household_id: householdId,
  });
  return this.repository.save(entity);
}
```

### After (BaseRepository)

```typescript
async findAll(householdId: string) {
  return this.repository.findWithHousehold(householdId);
}

async findOne(id: string, householdId: string) {
  return this.repository.findByIdWithHousehold(householdId, id);
}

async create(dto: CreateDto, householdId: string) {
  return this.repository.saveWithHousehold(householdId, dto);
}
```

## Best Practices

1. **Always pass household ID from request context**
   ```typescript
   @Get()
   async findAll(@Request() req: any) {
     const householdId = req.user.householdId;
     return this.service.findAll(householdId);
   }
   ```

2. **Use specific methods for clarity**
   - Use `findByIdWithHousehold` instead of `findOneWithHousehold` for ID lookups
   - Use `deleteWithHousehold` for soft deletes
   - Use `removeWithHousehold` for hard deletes

3. **Leverage query builder for complex queries**
   ```typescript
   const qb = this.repository.createQueryBuilderWithHousehold(
     householdId,
     'transaction',
   );
   
   return qb
     .leftJoinAndSelect('transaction.category', 'category')
     .where('transaction.amount > :amount', { amount: 100 })
     .getMany();
   ```

4. **Handle errors appropriately**
   ```typescript
   try {
     return await this.repository.findByIdWithHousehold(householdId, id);
   } catch (error) {
     if (error instanceof ForbiddenException) {
       // Handle cross-household access attempt
     }
     throw error;
   }
   ```

## Testing

### Unit Tests
```typescript
describe('YourService', () => {
  it('should filter by household', async () => {
    const result = await service.findAll('household-1');
    
    expect(result.every(e => e.household_id === 'household-1')).toBe(true);
  });

  it('should throw on cross-household access', async () => {
    await expect(
      service.findOne('entity-from-household-2', 'household-1'),
    ).rejects.toThrow(ForbiddenException);
  });
});
```

## Error Reference

| Error | When | Solution |
|-------|------|----------|
| `BadRequestException: Household context is required` | No household ID provided | Ensure household ID is passed from request |
| `ForbiddenException: Access denied: Resource belongs to different household` | Trying to access/modify another household's data | Verify household ID is correct |
| `ForbiddenException: Entity not found in household` | Entity doesn't exist in household | Check entity ID and household ownership |

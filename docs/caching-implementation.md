# Redis Caching Implementation Summary

## Overview
Implemented comprehensive Redis-based caching across the application to reduce database load and improve response times. All caching is multi-tenant aware with automatic key namespacing by household_id.

## Infrastructure

### CacheService (`libs/cache/cache.service.ts`)
- **Purpose**: Multi-tenant cache service with automatic key namespacing
- **Key Methods**:
  - `get<T>(householdId, key)` - Retrieve cached value
  - `set<T>(householdId, key, value, ttl)` - Store value with TTL
  - `del(householdId, key)` - Delete specific cache entry
  - `wrap<T>(householdId, key, fn, ttl)` - Cache-aside pattern helper
  - `delPattern(householdId, pattern)` - Delete by pattern
  - `clearHousehold(householdId)` - Clear all household cache
- **Key Format**: `household:{householdId}:{resource}:{identifier}`
- **Features**: Debug logging (HIT/MISS), error handling, automatic expiration

### CacheModule (`libs/cache/cache.module.ts`)
- **Store**: Redis (cache-manager-redis-store)
- **Configuration**: 
  - Host/port/password from environment variables
  - Default TTL: 300 seconds (5 minutes)
  - Max items: 100
- **Registration**: Global module (available everywhere)

## Service Implementations

### AccountsService
**File**: `src/accounts/accounts.service.ts`
**TTL**: 300 seconds (5 minutes)

| Method | Cache Strategy | Cache Keys Affected |
|--------|---------------|-------------------|
| `findOne(id)` | Cache read → DB on miss → Cache write | `accounts:{id}` |
| `getAccountSummary()` | Wrap pattern | `accounts:summary` |
| `create()` | Invalidate on write | `accounts:list`, `accounts:summary` |
| `update(id)` | Invalidate on write | `accounts:{id}`, `accounts:list`, `accounts:summary` |
| `remove(id)` | Invalidate on write | `accounts:{id}`, `accounts:list`, `accounts:summary` |
| `updateBalance(id)` | Invalidate on write | `accounts:{id}`, `accounts:summary` |

### HouseholdsService
**File**: `src/households/households.service.ts`
**TTL**: 300 seconds (5 minutes)

| Method | Cache Strategy | Cache Keys Affected |
|--------|---------------|-------------------|
| `findOne(id)` | Cache read → DB on miss → Cache write | `households:{id}` |
| `getHouseholdStats()` | Wrap pattern | `households:{id}:stats` |
| `create()` | Invalidate on write | `households:list` |
| `update(id)` | Invalidate on write | `households:{id}`, `households:list`, `households:{id}:stats` |
| `remove(id)` | Invalidate on write | `households:{id}`, `households:list`, `households:{id}:stats` |

### UsersService
**File**: `src/users/users.service.ts`
**TTL**: 300 seconds (5 minutes)

| Method | Cache Strategy | Cache Keys Affected |
|--------|---------------|-------------------|
| `findOne(id)` | Cache read → DB on miss → Cache write | `users:{id}` |
| `findByEmail(email)` | Cache read → DB on miss → Cache write | `users:email:{email}` |
| `create()` | Invalidate on write | `users:list`, `users:email:{email}` |
| `update(id)` | Invalidate on write | `users:{id}`, `users:email:{email}`, `users:list` |
| `remove(id)` | Invalidate on write | `users:{id}`, `users:email:{email}`, `users:list` |

### CategoryService
**File**: `src/expenses/services/category.service.ts`
**TTL**: 300 seconds (5 minutes)

| Method | Cache Strategy | Cache Keys Affected |
|--------|---------------|-------------------|
| `findOne(id)` | Cache read → DB on miss → Cache write | `categories:{id}` |
| `create()` | Invalidate on write | `categories:list`, `categories:hierarchy` |
| `update(id)` | Invalidate on write | `categories:{id}`, `categories:list`, `categories:hierarchy` |
| `remove(id)` | Invalidate on write | `categories:{id}`, `categories:list`, `categories:hierarchy` |

### LoansService
**File**: `src/loans/services/loans.service.ts`
**TTL**: 300 seconds (5 minutes)

| Method | Cache Strategy | Cache Keys Affected |
|--------|---------------|-------------------|
| `findOne(id)` | Cache read → DB on miss → Cache write | `loans:{id}` |
| `create()` | Invalidate on write | `loans:list`, `loans:summary` |
| `update(id)` | Invalidate on write | `loans:{id}`, `loans:list`, `loans:summary` |
| `remove(id)` | Invalidate on write | `loans:{id}`, `loans:list`, `loans:summary` |

### GoalsService
**File**: `src/accounts/accounts.service.ts`
**TTL**: 300 seconds (5 minutes)

| Method | Cache Strategy | Cache Keys Affected |
|--------|---------------|-------------------|
| `findOne(id)` | Cache read → DB on miss → Cache write | `accounts:{id}` |
| `getAccountSummary()` | Wrap pattern | `accounts:summary` |
| `create()` | Invalidate on write | `accounts:list`, `accounts:summary` |
| `update(id)` | Invalidate on write | `accounts:{id}`, `accounts:list`, `accounts:summary` |
| `remove(id)` | Invalidate on write | `accounts:{id}`, `accounts:list`, `accounts:summary` |
| `updateBalance(id)` | Invalidate on write | `accounts:{id}`, `accounts:summary` |

### GoalsService
**File**: `src/goals/services/goals.service.ts`
**TTL**: 300 seconds (5 minutes)

| Method | Cache Strategy | Cache Keys Affected |
|--------|---------------|-------------------|
| `findOne(id)` | Cache read → DB on miss → Cache write | `goals:{id}` |
| `getSummary()` | Wrap pattern | `goals:summary` |
| `create()` | Invalidate on write | `goals:list`, `goals:summary` |
| `update(id)` | Invalidate on write | `goals:{id}`, `goals:list`, `goals:summary` |
| `remove(id)` | Invalidate on write | `goals:{id}`, `goals:list`, `goals:summary` |
| `contribute(id)` | Invalidate on write | `goals:{id}`, `goals:list`, `goals:summary` |
| `withdraw(id)` | Invalidate on write | `goals:{id}`, `goals:list`, `goals:summary` |

### TransactionService
**File**: `src/expenses/services/transaction.service.ts`
**TTL**: 180 seconds (3 minutes) - Shorter due to frequent changes

| Method | Cache Strategy | Cache Keys Affected |
|--------|---------------|-------------------|
| `findOne(id)` | Cache read → DB on miss → Cache write | `transactions:{id}` |
| `getTransactionSummary(startDate, endDate)` | Wrap pattern with date-based key | `transactions:summary:{startDate}:{endDate}` |
| `create()` | Invalidate on write | `transactions:list`, `transactions:summary` |
| `update(id)` | Invalidate on write | `transactions:{id}`, `transactions:list`, `transactions:summary` |
| `remove(id)` | Invalidate on write | `transactions:{id}`, `transactions:list`, `transactions:summary` |
| `updateStatus(id)` | Invalidate on write | `transactions:{id}`, `transactions:list`, `transactions:summary` |
| `duplicateTransaction(id)` | Invalidate on write | `transactions:list`, `transactions:summary` |

### InsightsService
**File**: `src/insights/services/insights.service.ts`
**TTL**: 600 seconds (10 minutes) - Longer as insights change less frequently

| Method | Cache Strategy | Cache Keys Affected |
|--------|---------------|-------------------|
| `findOne(id)` | Cache read → DB on miss → View tracking → Cache write | `insights:{id}` |
| `getSummary()` | Wrap pattern | `insights:summary` |
| `create()` | Invalidate on write | `insights:list`, `insights:summary` |
| `update(id)` | Invalidate on write | `insights:{id}`, `insights:list`, `insights:summary` |
| `remove(id)` | Invalidate on write | `insights:{id}`, `insights:list`, `insights:summary` |
| `acknowledge(id)` | Invalidate on write | `insights:{id}`, `insights:list`, `insights:summary` |
| `dismiss(id)` | Invalidate on write | `insights:{id}`, `insights:list`, `insights:summary` |

## Cache Key Patterns

### By Resource Type
```
household:{householdId}:accounts:{id}
household:{householdId}:accounts:list
household:{householdId}:accounts:summary

household:{householdId}:goals:{id}
household:{householdId}:goals:list
household:{householdId}:goals:summary

household:{householdId}:transactions:{id}
household:{householdId}:transactions:list
household:{householdId}:transactions:summary:{startDate}:{endDate}

household:{householdId}:insights:{id}
household:{householdId}:insights:list
household:{householdId}:insights:summary
```

## TTL Strategy

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Transactions | 180s (3 min) | High frequency of changes (daily spending) |
| Accounts | 300s (5 min) | Moderate change frequency (balance updates) |
| Goals | 300s (5 min) | Moderate change frequency (contributions) |
| Insights | 600s (10 min) | Low change frequency (generated periodically) |

## Cache Patterns Used

### 1. Cache-Aside (Read-Through)
Used in `findOne()` methods:
```typescript
const cached = await this.cacheService.get<T>(householdId, cacheKey);
if (cached) return cached;

const entity = await repository.findOne(...);
await this.cacheService.set(householdId, cacheKey, entity, this.CACHE_TTL);
return entity;
```

### 2. Wrap Pattern
Used in summary methods:
```typescript
return this.cacheService.wrap(
  householdId,
  'resource:summary',
  async () => {
    // Calculate summary from DB
    return summary;
  },
  this.CACHE_TTL,
);
```

### 3. Write-Through with Invalidation
Used in create/update/delete methods:
```typescript
const saved = await repository.save(entity);

// Invalidate affected caches
await this.cacheService.del(householdId, `resource:${id}`);
await this.cacheService.del(householdId, 'resource:list');
await this.cacheService.del(householdId, 'resource:summary');

return saved;
```

## Special Handling

### InsightsService View Tracking
The `findOne()` method increments `view_count` even on cache hits to maintain accurate tracking:

```typescript
const cached = await this.cacheService.get<Insight>(householdId, cacheKey);
if (cached) {
  // Still track view even with cache
  cached.view_count += 1;
  cached.last_viewed_at = new Date();
  await this.insightRepository.saveWithHousehold(householdId, cached);
  return cached;
}
```

### TransactionService Date-Based Summary
The summary cache key includes date filters to support multiple cached summaries:

```typescript
const cacheKey = `transactions:summary:${startDate || 'all'}:${endDate || 'all'}`;
```

## Multi-Tenant Isolation

All cache keys include `household:{householdId}:` prefix to ensure:
- **Data Isolation**: No cross-household data leakage
- **Tenant-Specific Invalidation**: Can clear all cache for a household
- **Independent TTLs**: Each household's cache expires independently

## Testing Cache Behavior

### Observing Cache Performance
Debug logs show cache hits/misses:
```
[Cache] HIT: household:123e4567-e89b-12d3-a456-426614174000:accounts:abc123
[Cache] MISS: household:123e4567-e89b-12d3-a456-426614174000:goals:def456
```

### Testing via Swagger
1. **First Request**: Should be MISS → DB query
2. **Second Request (within TTL)**: Should be HIT → No DB query
3. **After Update**: Cache invalidated → Next request is MISS
4. **After TTL Expiration**: Natural MISS → Refetch from DB

### Manual Cache Operations
```bash
# View Redis keys
redis-cli --scan --pattern "household:*"

# Check specific key
redis-cli GET "household:123e4567:accounts:abc123"

# Clear household cache
redis-cli DEL $(redis-cli --scan --pattern "household:123e4567:*")

# Monitor cache activity
redis-cli MONITOR
```

## Performance Impact

### Expected Improvements
- **Read Operations**: 80-95% reduction in DB queries for frequently accessed data
- **Response Times**: 50-80% faster for cached data (typical 5-20ms vs 50-200ms)
- **Database Load**: Significant reduction in SELECT queries
- **Scalability**: Better support for concurrent users without DB scaling

### Cache Hit Rate Targets
- **Individual Entity Reads**: 70-85% (frequently accessed items)
- **Summary/Aggregate Queries**: 60-75% (varies by usage patterns)
- **List Operations**: 50-70% (depends on pagination and filters)

## Monitoring & Observability

### Metrics to Track
1. **Cache Hit Rate**: `hits / (hits + misses)`
2. **Average Response Time**: Compare cached vs non-cached
3. **Database Query Count**: Monitor reduction over time
4. **Cache Memory Usage**: Track Redis memory consumption
5. **Eviction Rate**: Monitor if cache is full and evicting entries

### Tools
- **Redis CLI**: Real-time monitoring and debugging
- **Application Logs**: Cache HIT/MISS debug logs
- **APM Tools**: Monitor response times and query counts

## Future Enhancements

### Phase 1 (Completed)
- ✅ CacheService with multi-tenant support
- ✅ Cache read/write for findOne methods
- ✅ Cache invalidation on updates/deletes
- ✅ Summary method caching

### Phase 2 (Recommended)
- [ ] Cache warming on application start
- [ ] Predictive pre-caching based on user behavior
- [ ] Cache statistics endpoint for monitoring
- [ ] Automatic cache size management

### Phase 3 (Advanced)
- [ ] Distributed cache invalidation for horizontal scaling
- [ ] Per-user cache preferences (opt-out for sensitive data)
- [ ] Cache compression for large objects
- [ ] Tiered caching (Redis + in-memory)

## Configuration

### Environment Variables
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
CACHE_TTL=300  # Default TTL in seconds
```

### Adjust TTLs Per Service
Edit the `CACHE_TTL` constant in each service:
```typescript
private readonly CACHE_TTL = 300; // seconds
```

## Troubleshooting

### Cache Not Working
1. Check Redis connection: `redis-cli PING` → should return `PONG`
2. Verify environment variables are set
3. Check application logs for cache errors
4. Ensure CacheModule is imported in app.module.ts

### Stale Data Issues
1. Verify invalidation logic in update/delete methods
2. Check if TTL is too long for data volatility
3. Manually clear cache: `await cacheService.clearHousehold(householdId)`

### Memory Issues
1. Monitor Redis memory: `redis-cli INFO memory`
2. Reduce TTL values if cache is growing too large
3. Implement cache size limits in Redis config
4. Consider cache eviction policies (LRU, LFU)

## Security Considerations

1. **Tenant Isolation**: All keys prefixed with household_id
2. **Sensitive Data**: Consider excluding sensitive fields from cache
3. **Access Control**: Cache service respects repository access patterns
4. **Redis Security**: Use password authentication, network isolation
5. **Data Retention**: Cache automatically expires (TTL-based cleanup)

---

**Implementation Date**: 2024
**Status**: ✅ Complete
**Next Steps**: Monitor performance in production and tune TTLs as needed

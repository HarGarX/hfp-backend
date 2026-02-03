# API Rate Limiting

## Overview
The HFP API implements comprehensive rate limiting to protect against abuse and ensure fair resource allocation across households. Rate limiting is implemented using Redis-backed distributed storage, allowing it to work across multiple server instances.

## Architecture

### Components
1. **ThrottleModule** (`libs/throttle/throttle.module.ts`)
   - Configures @nestjs/throttler with Redis storage
   - Defines 3 rate limit tiers: anonymous, authenticated, admin
   - Custom ThrottlerStorageRedis implementation for distributed storage

2. **RoleBasedThrottlerGuard** (`libs/throttle/guards/role-based-throttler.guard.ts`)
   - Applied globally via APP_GUARD
   - Automatically selects rate limit based on user role
   - Tracks anonymous users by IP, authenticated users by user ID

3. **HouseholdThrottlerGuard** (`libs/throttle/guards/household-throttler.guard.ts`)
   - Applied to specific controllers (Accounts, Transactions, Insights)
   - Tracks requests per household (5000 requests/hour)
   - Prevents single household from monopolizing resources

## Rate Limit Tiers

### Anonymous Users (IP-based tracking)
- **Limit**: 100 requests/hour
- **Use Case**: Public endpoints, unauthenticated access
- **Tracking**: IP address (`ip:{ip_address}`)

### Authenticated Users (User-based tracking)
- **Limit**: 1000 requests/hour
- **Use Case**: Standard household members
- **Tracking**: User ID (`user:{user_id}`)

### Admin Users
- **Limit**: 10,000 requests/hour (effectively unlimited)
- **Use Case**: System administrators, support staff
- **Tracking**: User ID (`user:{user_id}`)

### Per-Household Limits
- **Limit**: 5000 requests/hour
- **Use Case**: High-traffic households with multiple members
- **Tracking**: Household ID (`household:{household_id}`)
- **Applied To**: 
  - `/accounts/*` - Account operations
  - `/transactions/*` - Transaction operations
  - `/insights/*` - Insights and analytics

## Rate Limit Headers

### Standard Headers (All Endpoints)
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 985
X-RateLimit-Reset: 1675430400
Retry-After: 3600
```

### Household Headers (Protected Endpoints)
```
X-Household-RateLimit-Limit: 5000
X-Household-RateLimit-Remaining: 4892
X-Household-RateLimit-Reset: 1675430400
```

## HTTP 429 Response

When rate limit is exceeded:
```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "error": "Too Many Requests"
}
```

Headers included:
- `Retry-After`: Seconds until limit resets
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Configuration

### Environment Variables
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

### Customizing Limits
Update `libs/throttle/throttle.module.ts`:
```typescript
throttlers: [
  {
    name: 'authenticated',
    ttl: 3600000, // 1 hour in milliseconds
    limit: 1000,  // Adjust limit here
  },
]
```

## Decorators

### @SkipThrottle()
Skip rate limiting for specific endpoints:
```typescript
@Get('health')
@SkipThrottle()
healthCheck() {
  return { status: 'ok' };
}
```

### @ThrottleConfig()
Override default rate limit for specific endpoint:
```typescript
@Post('bulk-import')
@ThrottleConfig({ limit: 10, ttl: 60000 }) // 10 requests per minute
bulkImport(@Body() data: any[]) {
  // Handle bulk import
}
```

## Testing Rate Limiting

### Using Swagger UI
1. Start the backend server: `npm run start:dev`
2. Open Swagger UI: http://localhost:3000/api
3. Test anonymous limits:
   - Make 100+ requests to `/auth/login` (no token)
   - Verify 429 response after 100 requests
4. Test authenticated limits:
   - Authenticate and make 1000+ requests
   - Check rate limit headers
5. Test household limits:
   - Make 5000+ requests to `/accounts` or `/transactions`
   - Verify household-specific headers

### Using curl
```bash
# Test anonymous limit
for i in {1..105}; do
  curl -i http://localhost:3000/api/health
done

# Test authenticated limit (with JWT token)
TOKEN="your_jwt_token"
for i in {1..1005}; do
  curl -i -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/accounts
done
```

### Using Artillery (Load Testing)
```yaml
# artillery-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 20  # 20 requests/second = 1200/minute
scenarios:
  - name: 'Test Rate Limiting'
    flow:
      - get:
          url: '/api/accounts'
          headers:
            Authorization: 'Bearer {{token}}'
```

Run: `artillery run artillery-test.yml`

## Redis Keys

### Rate Limit Keys
- Anonymous: `throttle:anonymous:ip:192.168.1.1`
- Authenticated: `throttle:authenticated:user:uuid-here`
- Admin: `throttle:admin:user:uuid-here`
- Household: `throttle:household:household:uuid-here`

### Key Expiration
All keys automatically expire after TTL (3600 seconds = 1 hour)

## Monitoring

### Check Current Rate Limit Status (Redis CLI)
```bash
# Connect to Redis
redis-cli

# Check all throttle keys
SCAN 0 MATCH throttle:*

# Check specific user's limit
GET throttle:authenticated:user:123e4567-e89b-12d3-a456-426614174000
TTL throttle:authenticated:user:123e4567-e89b-12d3-a456-426614174000

# Check household limit
GET throttle:household:household:123e4567-e89b-12d3-a456-426614174000
```

### Reset Rate Limit (Manual)
```bash
# Reset specific user
DEL throttle:authenticated:user:uuid-here

# Reset entire household
DEL throttle:household:household:uuid-here

# Clear all rate limits
SCAN 0 MATCH throttle:* | xargs redis-cli DEL
```

## Best Practices

### For API Consumers
1. **Check Headers**: Always inspect `X-RateLimit-Remaining` before making bulk requests
2. **Implement Backoff**: Use exponential backoff when receiving 429 responses
3. **Cache Responses**: Cache GET responses to reduce API calls
4. **Batch Operations**: Use bulk endpoints instead of multiple single requests

### For Developers
1. **Skip Health Checks**: Always use `@SkipThrottle()` for health/status endpoints
2. **Custom Limits**: Apply `@ThrottleConfig()` to expensive operations (bulk imports, reports)
3. **Household Guard**: Add `HouseholdThrottlerGuard` to resource-intensive endpoints
4. **Monitor Redis**: Set up alerts for Redis connection failures

## Troubleshooting

### Issue: 429 responses for legitimate traffic
**Solution**: Check if household limit (5000/hr) is too low for large households
```typescript
// Increase household limit in throttle.module.ts
HouseholdThrottlerGuard.HOUSEHOLD_LIMIT = 10000;
```

### Issue: Rate limits not resetting
**Solution**: Verify Redis is running and keys have TTL set
```bash
docker ps | grep redis
redis-cli TTL throttle:authenticated:user:uuid-here
```

### Issue: Different limits across server instances
**Solution**: Ensure all servers use same Redis instance (not in-memory storage)

## Security Considerations

1. **DDoS Protection**: Rate limiting provides basic DDoS protection but should be combined with:
   - WAF (Web Application Firewall)
   - Cloudflare/CDN protection
   - IP allowlisting for admin endpoints

2. **Token Theft**: Rate limiting won't prevent abuse if JWT token is stolen
   - Implement token refresh rotation
   - Add device fingerprinting
   - Monitor unusual access patterns

3. **Bypass Prevention**:
   - Track by user ID (not just IP) to prevent IP rotation
   - Implement household limits to prevent distributed attacks
   - Monitor Redis for suspicious key patterns

## Future Enhancements

1. **Dynamic Rate Limits**: Adjust limits based on server load
2. **Per-Endpoint Limits**: Different limits for read vs write operations
3. **Burst Allowance**: Allow temporary bursts above limit
4. **Webhook Rate Limits**: Separate limits for incoming webhooks
5. **Analytics Dashboard**: Visualize rate limit usage and violations
6. **Notification System**: Alert admins when rate limits are frequently exceeded

## References
- [@nestjs/throttler Documentation](https://docs.nestjs.com/security/rate-limiting)
- [Redis Commands](https://redis.io/commands)
- [HTTP 429 Status Code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429)

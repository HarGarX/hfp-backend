# Enhanced Logging System

## Overview
The HFP backend implements a comprehensive logging system using Winston, providing structured logging, log rotation, audit trails, and performance monitoring. All logs are structured as JSON for easy parsing and analysis.

## Architecture

### Components
1. **LoggerModule** (`libs/logger/logger.module.ts`)
   - Global module providing Winston logger configuration
   - Multiple transports: Console, Daily Rotate Files
   - Environment-specific configuration

2. **EnhancedLoggingInterceptor** (`libs/logger/interceptors/enhanced-logging.interceptor.ts`)
   - Applied globally to all HTTP requests
   - Logs request/response details with timing
   - Detects and logs slow requests (>1000ms)
   - Sanitizes sensitive data (passwords, tokens)

3. **AuditLogService** (`libs/logger/services/audit-log.service.ts`)
   - Dedicated service for audit logging
   - Tracks sensitive operations (CREATE, UPDATE, DELETE, ACCESS, etc.)
   - Records user, household, IP, and metadata

4. **AuditLogInterceptor** (`libs/logger/interceptors/audit-log.interceptor.ts`)
   - Works with @AuditLog() decorator
   - Automatically logs operations marked for auditing

## Log Levels

Winston supports the following log levels (in order of severity):
- `error` - Critical errors requiring immediate attention
- `warn` - Warning messages for potential issues
- `info` - General informational messages (default)
- `http` - HTTP request/response logs
- `verbose` - Detailed operational information
- `debug` - Debug information for development
- `silly` - Very verbose debug information

## Log Transports

### Console Transport
- **Always Enabled**: Yes
- **Format**: Colorized in development, JSON in production
- **Use Case**: Real-time monitoring during development

### Daily Rotate File Transports
- **Enabled**: In production or when `LOG_TO_FILE=true`
- **Rotation**: Daily at midnight
- **Compression**: Automatic gzip after rotation
- **Max Size**: 20MB per file
- **Retention**:
  - Application logs: 14 days
  - Error logs: 30 days
  - Audit logs: 90 days
  - Exception logs: 30 days
  - Rejection logs: 30 days

### Log Files
```
logs/
├── application-2026-02-03.log    # All logs (info level)
├── error-2026-02-03.log          # Errors only
├── audit-2026-02-03.log          # Audit events
├── exceptions-2026-02-03.log     # Uncaught exceptions
└── rejections-2026-02-03.log     # Unhandled promise rejections
```

## Configuration

### Environment Variables
```env
# Log level: error, warn, info, http, verbose, debug, silly
LOG_LEVEL=info

# Enable file logging (optional in development)
LOG_TO_FILE=false

# Log directory (default: logs)
LOG_DIR=logs

# Node environment
NODE_ENV=development
```

### Production Configuration
```env
LOG_LEVEL=info
LOG_TO_FILE=true
LOG_DIR=/var/log/hfp
NODE_ENV=production
```

## Log Format

### Structured JSON Format
All logs follow a consistent JSON structure:
```json
{
  "timestamp": "2026-02-03 15:30:45",
  "level": "info",
  "message": "Request completed",
  "context": "HTTP",
  "meta": {
    "requestId": "1738596645000-abc123",
    "method": "POST",
    "url": "/api/accounts",
    "statusCode": 201,
    "duration": "125ms",
    "userId": "123e4567-e89b-12d3-a456-426614174000",
    "householdId": "987fcdeb-51a2-43e8-b9c0-123456789abc"
  }
}
```

### Console Format (Development)
```
2026-02-03 15:30:45 info [HTTP] Request completed
```

## HTTP Request Logging

### Incoming Request
```json
{
  "timestamp": "2026-02-03 15:30:45",
  "level": "info",
  "message": "Incoming request",
  "context": "HTTP",
  "requestId": "1738596645000-abc123",
  "method": "POST",
  "url": "/api/accounts",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "householdId": "987fcdeb-51a2-43e8-b9c0-123456789abc",
  "body": {
    "name": "Chase Checking",
    "account_type": "checking",
    "password": "***REDACTED***"
  }
}
```

### Request Completed
```json
{
  "timestamp": "2026-02-03 15:30:45",
  "level": "info",
  "message": "Request completed",
  "context": "HTTP",
  "requestId": "1738596645000-abc123",
  "method": "POST",
  "url": "/api/accounts",
  "statusCode": 201,
  "duration": "125ms",
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "householdId": "987fcdeb-51a2-43e8-b9c0-123456789abc"
}
```

### Slow Request Detection
Requests taking longer than 1000ms are automatically logged as warnings:
```json
{
  "timestamp": "2026-02-03 15:30:46",
  "level": "warn",
  "message": "Slow request detected",
  "context": "Performance",
  "requestId": "1738596645000-abc123",
  "method": "GET",
  "url": "/api/insights/summary",
  "duration": "1523ms",
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "householdId": "987fcdeb-51a2-43e8-b9c0-123456789abc"
}
```

### Request Failed (Error)
```json
{
  "timestamp": "2026-02-03 15:30:45",
  "level": "error",
  "message": "Request failed",
  "context": "HTTP",
  "requestId": "1738596645000-abc123",
  "method": "POST",
  "url": "/api/accounts",
  "statusCode": 400,
  "duration": "45ms",
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "householdId": "987fcdeb-51a2-43e8-b9c0-123456789abc",
  "error": {
    "name": "BadRequestException",
    "message": "Credit card accounts must have a credit limit",
    "stack": "BadRequestException: Credit card accounts must have a credit limit\n    at AccountsService.create..."
  }
}
```

## Audit Logging

### AuditAction Types
```typescript
enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  ACCESS = 'ACCESS',
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',
  SHARE = 'SHARE',
  REVOKE = 'REVOKE',
}
```

### Using @AuditLog Decorator
```typescript
import { AuditLog, AuditAction } from '../../libs/logger';

@Post()
@AuditLog(AuditAction.CREATE, 'account')
create(@Body() createDto: CreateAccountDto) {
  // Create account logic
}

@Delete(':id')
@AuditLog(AuditAction.DELETE, 'account')
delete(@Param('id') id: string) {
  // Delete account logic
}
```

### Using AuditLogService Directly
```typescript
import { AuditLogService } from '../../libs/logger';

@Injectable()
export class AccountsService {
  constructor(
    private readonly auditLogService: AuditLogService,
  ) {}

  async updateBalance(accountId: string, amount: number, userId: string, householdId: string) {
    // Update balance logic
    
    this.auditLogService.logUpdate(
      'account',
      accountId,
      userId,
      householdId,
      { oldBalance: 1000, newBalance: 1500, change: 500 },
    );
  }
}
```

### Audit Log Format
```json
{
  "timestamp": "2026-02-03 15:30:45",
  "level": "info",
  "message": "Audit event",
  "context": "Audit",
  "action": "CREATE",
  "resource": "account",
  "resourceId": "123e4567-e89b-12d3-a456-426614174000",
  "userId": "987fcdeb-51a2-43e8-b9c0-123456789abc",
  "householdId": "abc12345-def6-7890-abcd-ef1234567890",
  "metadata": {
    "params": { "id": "123e4567-e89b-12d3-a456-426614174000" },
    "query": {}
  },
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0..."
}
```

## Sensitive Data Sanitization

The logging system automatically redacts sensitive fields from request bodies:
- `password`
- `token`
- `secret`
- `apiKey`
- `creditCard`

Example:
```json
// Original request body
{
  "username": "john@example.com",
  "password": "MySecretPass123",
  "apiKey": "sk_live_abc123"
}

// Logged request body
{
  "username": "john@example.com",
  "password": "***REDACTED***",
  "apiKey": "***REDACTED***"
}
```

## Performance Monitoring

### Slow Request Thresholds
- **Warning**: Requests > 1000ms
- **Critical**: Requests > 5000ms (should be added as custom logic)

### Slow Database Queries
You can add query logging in services:
```typescript
import { Logger } from '@nestjs/common';

export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  async findAll(householdId: string) {
    const startTime = Date.now();
    const accounts = await this.accountRepository.find({ where: { household_id: householdId } });
    const duration = Date.now() - startTime;

    if (duration > 1000) {
      this.logger.warn(`Slow query detected: findAll took ${duration}ms`, {
        context: 'Performance',
        method: 'findAll',
        householdId,
        duration,
      });
    }

    return accounts;
  }
}
```

## Error Tracking

### Automatic Exception Handling
Winston automatically captures:
- **Uncaught Exceptions**: Logged to `exceptions-YYYY-MM-DD.log`
- **Unhandled Promise Rejections**: Logged to `rejections-YYYY-MM-DD.log`

### Error Log Format
```json
{
  "timestamp": "2026-02-03 15:30:45",
  "level": "error",
  "message": "Database connection failed",
  "context": "DatabaseModule",
  "trace": "Error: Database connection failed\n    at Connection.connect (/app/src/database/connection.ts:45:15)\n    at async DatabaseModule.onModuleInit (/app/src/database/database.module.ts:20:5)"
}
```

## Log Analysis

### Using jq to Query Logs
```bash
# Find all errors in the last hour
cat logs/error-2026-02-03.log | jq 'select(.timestamp > "2026-02-03 14:30:00")'

# Find slow requests
cat logs/application-2026-02-03.log | jq 'select(.context == "Performance" and .message == "Slow request detected")'

# Find all audit events for a specific user
cat logs/audit-2026-02-03.log | jq 'select(.userId == "123e4567-e89b-12d3-a456-426614174000")'

# Count requests by endpoint
cat logs/application-2026-02-03.log | jq -r '.url' | sort | uniq -c | sort -rn

# Average request duration
cat logs/application-2026-02-03.log | jq -r '.duration | select(. != null) | sub("ms"; "") | tonumber' | awk '{sum+=$1; count++} END {print "Average:", sum/count, "ms"}'
```

### Using ELK Stack (Future Enhancement)
For production, consider sending logs to Elasticsearch for powerful querying:
```bash
# Install Filebeat to ship logs to Elasticsearch
filebeat -c filebeat.yml

# Query in Kibana
GET /logs-hfp-*/_search
{
  "query": {
    "bool": {
      "must": [
        { "match": { "context": "Audit" } },
        { "range": { "timestamp": { "gte": "now-1h" } } }
      ]
    }
  }
}
```

## Best Practices

### 1. Use Appropriate Log Levels
```typescript
// ❌ Bad - Using wrong log level
this.logger.error('User logged in successfully'); // Should be info

// ✅ Good - Correct log level
this.logger.info('User logged in successfully');
this.logger.warn('Low disk space: 10% remaining');
this.logger.error('Failed to connect to database');
```

### 2. Include Context
```typescript
// ❌ Bad - No context
this.logger.info('Operation completed');

// ✅ Good - Rich context
this.logger.info('Account created successfully', {
  accountId,
  accountType: 'checking',
  userId,
  householdId,
});
```

### 3. Log Structured Data
```typescript
// ❌ Bad - String concatenation
this.logger.info(`User ${userId} created account ${accountId}`);

// ✅ Good - Structured fields
this.logger.info('Account created', {
  userId,
  accountId,
  accountType: 'checking',
});
```

### 4. Use Audit Logging for Sensitive Operations
```typescript
// Always audit:
// - Create/Update/Delete operations
// - Login/Logout events
// - Data exports
// - Permission changes
// - Configuration changes

@Delete(':id')
@AuditLog(AuditAction.DELETE, 'account')
async delete(@Param('id') id: string, @CurrentUser() user: User) {
  return this.accountsService.delete(id, user.householdId);
}
```

### 5. Don't Log Sensitive Data
```typescript
// ❌ Bad - Logging passwords
this.logger.info('User login', { username, password });

// ✅ Good - Sanitized
this.logger.info('User login', { username });
```

## Monitoring and Alerts

### Log Monitoring Checklist
- [ ] Set up log rotation to prevent disk space issues
- [ ] Monitor error rates (> 5% should trigger alert)
- [ ] Track slow requests (> 10/min should trigger alert)
- [ ] Monitor audit log for suspicious activity
- [ ] Set up daily log summaries
- [ ] Archive old logs to S3/Cloud Storage

### Sample Alert Rules
```yaml
# Prometheus Alert Rules
groups:
  - name: logging_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(log_errors_total[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
          
      - alert: SlowRequests
        expr: rate(log_slow_requests_total[5m]) > 10
        for: 5m
        annotations:
          summary: "High number of slow requests"
```

## Troubleshooting

### Issue: No logs appearing in files
**Solution**: Check LOG_TO_FILE environment variable
```bash
# Enable file logging
export LOG_TO_FILE=true

# Verify log directory exists and is writable
mkdir -p logs
chmod 755 logs
```

### Issue: Log files growing too large
**Solution**: Adjust rotation settings in logger.module.ts
```typescript
new DailyRotateFile({
  maxSize: '10m',  // Reduce from 20m to 10m
  maxFiles: '7d',  // Reduce from 14d to 7d
})
```

### Issue: Too verbose logging in production
**Solution**: Set LOG_LEVEL to 'warn' or 'error'
```env
LOG_LEVEL=warn
```

### Issue: Missing audit logs
**Solution**: Ensure AuditLogInterceptor is applied
```typescript
// Apply to specific controller
@UseInterceptors(AuditLogInterceptor)
@Controller('accounts')
export class AccountsController {}

// Or use @AuditLog decorator on methods
@Post()
@AuditLog(AuditAction.CREATE, 'account')
create() {}
```

## Future Enhancements

1. **Distributed Tracing**: Integrate with OpenTelemetry for end-to-end tracing
2. **Log Aggregation**: Send logs to Elasticsearch/Splunk for centralized analysis
3. **Real-time Dashboards**: Create Grafana dashboards for log visualization
4. **Alerting**: Set up PagerDuty/Slack alerts for critical errors
5. **Log Sampling**: Sample high-volume logs in production (keep 10%, log all errors)
6. **Cost Optimization**: Compress and archive logs to S3 after 7 days

## References
- [Winston Documentation](https://github.com/winstonjs/winston)
- [NestJS Winston Integration](https://github.com/gremo/nest-winston)
- [winston-daily-rotate-file](https://github.com/winstonjs/winston-daily-rotate-file)
- [Structured Logging Best Practices](https://www.datadoghq.com/knowledge-center/structured-logging/)

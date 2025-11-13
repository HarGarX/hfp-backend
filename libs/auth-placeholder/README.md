# Auth Placeholder Module

## Purpose
This module provides placeholder types and constants for authentication during Sprint 1 development.

## Headers Expected
- `x-tenant-id`: Household/tenant identifier (required)
- `x-user-id`: User identifier for auditing (optional)

## Phase 2 Migration
When Keycloak is integrated in Phase 2, this module will be replaced with proper OAuth/JWT handling.

## Usage
```typescript
import { AUTH_HEADERS, TenantContext } from '@/libs/auth-placeholder';

// In interceptors or guards
const tenantId = req.headers[AUTH_HEADERS.TENANT_ID];
const userId = req.headers[AUTH_HEADERS.USER_ID];
```
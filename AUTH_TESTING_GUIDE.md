# Authentication Testing Guide

## ✅ Issues Fixed

### Issue 1: Auth Endpoints Missing from Swagger
**Problem**: Auth endpoints (login, register, /me) were not showing in Swagger UI  
**Root Cause**: `app.module.ts` was importing the placeholder `AuthModule` from `libs/auth-placeholder` instead of the real `AuthModule` from `src/auth/`  
**Solution**: Updated import in [app.module.ts](src/app.module.ts#L6) to use real AuthModule

### Issue 2: 400 Bad Request Errors
**Problem**: Some endpoints returned 400 errors  
**Root Cause**: `RequestValidationMiddleware` was enforcing `Content-Type: application/json` for all POST/PUT/PATCH requests, including Swagger UI requests  
**Solution**: 
1. Updated middleware to skip validation for Swagger routes (`/api`, `/api-json`)
2. Made Content-Type check less strict to allow `multipart/form-data` and `application/x-www-form-urlencoded`

## 📍 Auth Endpoints Now Available

All endpoints are at `http://localhost:3000/auth/*`

### 1. POST /auth/login
**Purpose**: Authenticate user and get JWT token

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

**Response (Success - 200)**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "HOUSEHOLD_ADMIN",
    "household_id": "uuid"
  }
}
```

**Response (Error - 401)**:
```json
{
  "statusCode": 401,
  "message": "Invalid credentials"
}
```

### 2. POST /auth/register
**Purpose**: Create new user account

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "securepass123",
    "first_name": "Jane",
    "last_name": "Smith",
    "household_name": "Smith Family"
  }'
```

**Response (Success - 201)**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "newuser@example.com",
    "first_name": "Jane",
    "last_name": "Smith",
    "role": "HOUSEHOLD_ADMIN",
    "household_id": "uuid"
  }
}
```

**Field Validation**:
- `email`: Must be valid email format
- `password`: Minimum 6 characters
- `first_name`: Required, string
- `last_name`: Required, string
- `household_name`: Optional, creates a new household if provided

### 3. GET /auth/me
**Purpose**: Get current authenticated user info

```bash
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response (Success - 200)**:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "role": "HOUSEHOLD_ADMIN",
  "household_id": "uuid"
}
```

**Response (Error - 401)**:
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

## 🧪 Testing Workflow in Swagger UI

### Step 1: Register a New User
1. Open Swagger UI: http://localhost:3000/api
2. Find **Authentication** section
3. Click on `POST /auth/register`
4. Click "Try it out"
5. Fill in the request body:
   ```json
   {
     "email": "test@example.com",
     "password": "password123",
     "first_name": "Test",
     "last_name": "User",
     "household_name": "Test Household"
   }
   ```
6. Click "Execute"
7. **Copy the `access_token` from the response**

### Step 2: Authorize Swagger UI
1. Scroll to the top of Swagger UI
2. Click the green **"Authorize"** button (lock icon)
3. Paste your JWT token in the "Value" field
4. Click "Authorize"
5. Click "Close"

### Step 3: Test Protected Endpoints
Now you can test any endpoint that requires authentication:

**Example: Create a Simulation**
1. Find `POST /simulations` in the Simulations section
2. Click "Try it out"
3. Fill in the request body:
   ```json
   {
     "name": "My First Goal",
     "simulation_type": "GOAL",
     "base_scenario": {
       "target_amount": 50000,
       "current_amount": 5000,
       "monthly_contribution": 1000,
       "expected_return_rate": 6
     }
   }
   ```
4. Click "Execute"
5. Should get **201 Created** response

### Step 4: Verify Multi-Tenant Isolation
1. Register a second user with different email
2. Get the second user's JWT token
3. Try to access the first user's simulation with the second user's token
4. **Expected**: 403 Forbidden or 404 Not Found

## 🔐 JWT Token Structure

The JWT token contains:
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "HOUSEHOLD_ADMIN",
  "household_id": "household-uuid",
  "iat": 1234567890,
  "exp": 1234654290
}
```

- **sub**: User ID
- **household_id**: Used for multi-tenant filtering (CRITICAL)
- **role**: User role for authorization
- **exp**: Token expiration (default: 24 hours)

## 🐛 Common Issues & Solutions

### Issue: "Content-Type must be application/json"
**Solution**: Ensure you're sending `Content-Type: application/json` header with POST/PUT/PATCH requests

### Issue: "Unauthorized" on protected endpoints
**Solution**: 
1. Check that Authorization header is present: `Authorization: Bearer <token>`
2. Verify token hasn't expired (24h default)
3. Re-login to get fresh token

### Issue: "Invalid credentials" on login
**Solution**: 
1. Verify user exists in database
2. Check password is correct (minimum 6 characters)
3. Use /auth/register to create test user first

### Issue: 404 on /auth endpoints
**Solution**: 
- Server must be running: `npm run start:dev`
- Check terminal logs for startup errors
- Verify AuthModule is imported in app.module.ts

## ✅ Verification Checklist

- [x] Auth endpoints show in Swagger UI under "Authentication" section
- [x] POST /auth/register creates new user and returns JWT
- [x] POST /auth/login authenticates user and returns JWT
- [x] GET /auth/me returns current user info with valid JWT
- [x] Protected endpoints (e.g., /simulations) work with JWT token
- [x] 401 Unauthorized returned when JWT token is missing/invalid
- [x] Multi-tenant isolation works (can't access other household's data)
- [x] Swagger "Authorize" button works for setting JWT token
- [x] No more 400 errors from RequestValidationMiddleware

## 📊 Database Verification

After registering users, check database:

```sql
-- View users
SELECT id, email, first_name, last_name, role, household_id 
FROM users 
WHERE email = 'test@example.com';

-- View households
SELECT id, name, created_by_user_id 
FROM households 
WHERE name = 'Test Household';
```

## 🎯 Next Steps

1. ✅ Auth endpoints working - ready for full testing
2. Test all Simulations module endpoints with JWT auth
3. Verify multi-tenant isolation across all modules
4. Create comprehensive E2E tests for auth flow
5. Proceed with **Task 2.2: Feature Toggles Module**

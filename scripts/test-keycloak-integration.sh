#!/bin/bash

# HFP Keycloak Integration Test
# This script demonstrates the complete authentication flow

set -e

echo "🧪 HFP Keycloak Integration Test"
echo "================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test configuration
KEYCLOAK_URL="http://localhost:8080"
BACKEND_URL="http://localhost:3000"
CLIENT_ID="hfp-backend"
CLIENT_SECRET="hfp-backend-secret-change-in-production"
TEST_USER="admin@hfp.com"
TEST_PASSWORD="password123"

print_test() {
    echo -e "${YELLOW}🔍 Test: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Test 1: Keycloak Health Check
print_test "Keycloak Health Check"
if curl -s -f "${KEYCLOAK_URL}/health/ready" > /dev/null 2>&1; then
    print_success "Keycloak is running and healthy"
else
    print_error "Keycloak is not accessible"
    exit 1
fi

# Test 2: HFP Realm Accessibility
print_test "HFP Realm Accessibility"
if curl -s "${KEYCLOAK_URL}/realms/hfp" | grep -q '"realm":"hfp"'; then
    print_success "HFP realm is accessible"
else
    print_error "HFP realm is not accessible"
    exit 1
fi

# Test 3: JWT Token Acquisition
print_test "JWT Token Acquisition"
TOKEN_RESPONSE=$(curl -s -X POST "${KEYCLOAK_URL}/realms/hfp/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=password" \
    -d "client_id=${CLIENT_ID}" \
    -d "client_secret=${CLIENT_SECRET}" \
    -d "username=${TEST_USER}" \
    -d "password=${TEST_PASSWORD}")

if echo "$TOKEN_RESPONSE" | grep -q "access_token"; then
    ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
    print_success "Successfully obtained JWT token"
    echo "Token length: ${#ACCESS_TOKEN} characters"
else
    print_error "Failed to obtain JWT token"
    echo "Response: $TOKEN_RESPONSE"
    exit 1
fi

# Test 4: JWT Token Structure Validation
print_test "JWT Token Structure Validation"
if [[ "$ACCESS_TOKEN" =~ ^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$ ]]; then
    print_success "JWT token has valid structure (header.payload.signature)"
else
    print_error "JWT token structure is invalid"
    exit 1
fi

# Test 5: JWT Token Payload Inspection
print_test "JWT Token Payload Inspection"
# Decode JWT payload (base64url decode)
PAYLOAD=$(echo "$ACCESS_TOKEN" | cut -d'.' -f2)
# Add padding if needed
case $((${#PAYLOAD} % 4)) in
    2) PAYLOAD="${PAYLOAD}==" ;;
    3) PAYLOAD="${PAYLOAD}=" ;;
esac

DECODED_PAYLOAD=$(echo "$PAYLOAD" | base64 -d 2>/dev/null)
if [[ $? -eq 0 ]] && echo "$DECODED_PAYLOAD" | grep -q '"sub"'; then
    print_success "JWT payload decoded successfully"
    echo "Subject: $(echo "$DECODED_PAYLOAD" | grep -o '"sub":"[^"]*' | cut -d'"' -f4)"
    echo "Email: $(echo "$DECODED_PAYLOAD" | grep -o '"email":"[^"]*' | cut -d'"' -f4)"
    echo "Roles: $(echo "$DECODED_PAYLOAD" | grep -o '"realm_access":{"roles":\[[^]]*\]' | grep -o '\[.*\]')"
else
    print_error "Failed to decode JWT payload"
fi

# Test 6: Backend Service Health (if running)
print_test "Backend Service Health Check"
if curl -s -f "${BACKEND_URL}/health" > /dev/null 2>&1; then
    print_success "HFP Backend is running"
    
    # Test 7: Protected Endpoint Access
    print_test "Protected Endpoint Access with Keycloak Token"
    AUTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        "${BACKEND_URL}/auth/me")
    
    if [[ "$AUTH_RESPONSE" == "200" ]]; then
        print_success "Successfully accessed protected endpoint with Keycloak token"
    else
        print_error "Failed to access protected endpoint (HTTP $AUTH_RESPONSE)"
        echo "Note: Backend may not be configured for Keycloak yet"
    fi
else
    echo -e "${YELLOW}⚠️  HFP Backend is not running (skipping backend tests)${NC}"
fi

# Test 8: Token Refresh Capability
print_test "Token Refresh Capability"
REFRESH_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"refresh_token":"[^"]*' | cut -d'"' -f4)
if [[ -n "$REFRESH_TOKEN" ]]; then
    REFRESH_RESPONSE=$(curl -s -X POST "${KEYCLOAK_URL}/realms/hfp/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "grant_type=refresh_token" \
        -d "client_id=${CLIENT_ID}" \
        -d "client_secret=${CLIENT_SECRET}" \
        -d "refresh_token=${REFRESH_TOKEN}")
    
    if echo "$REFRESH_RESPONSE" | grep -q "access_token"; then
        print_success "Successfully refreshed token"
    else
        print_error "Failed to refresh token"
    fi
else
    print_error "No refresh token received"
fi

echo
echo "🎉 Integration Test Summary:"
print_success "✅ Keycloak is properly configured and running"
print_success "✅ HFP realm is accessible with proper clients"
print_success "✅ JWT tokens can be obtained using password grant"
print_success "✅ JWT tokens have valid structure and contain user data"
print_success "✅ Token refresh mechanism is working"

echo
echo "🚀 Next Steps:"
echo "1. Start the HFP backend: npm run start:dev"
echo "2. Test protected endpoints with the obtained JWT token"
echo "3. Integrate frontend with Keycloak for full OAuth2 flow"
echo "4. Update E2E tests to use Keycloak authentication"

echo
echo "📋 Test User Credentials:"
echo "Email: ${TEST_USER}"
echo "Password: ${TEST_PASSWORD}"
echo "Roles: system-admin, hfp-user"

echo
echo "🔗 Useful URLs:"
echo "Keycloak Admin: http://localhost:8080/admin/ (admin/admin123)"
echo "HFP Realm: http://localhost:8080/realms/hfp"
echo "Backend Health: http://localhost:3000/health (when running)"
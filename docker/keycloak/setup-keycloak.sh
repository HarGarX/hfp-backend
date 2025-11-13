#!/bin/bash

# HFP Keycloak Setup Script
# This script configures Keycloak for multi-tenant HFP deployment

set -e

echo "🚀 Starting HFP Keycloak Configuration Setup..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration variables
KEYCLOAK_URL="http://localhost:8080"
ADMIN_USER="admin"
ADMIN_PASS="admin123"
REALM_NAME="hfp"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Function to wait for Keycloak to be ready
wait_for_keycloak() {
    print_info "Waiting for Keycloak to be ready..."
    local max_attempts=60
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "${KEYCLOAK_URL}/health/ready" > /dev/null 2>&1; then
            print_status "Keycloak is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "Keycloak failed to become ready within 2 minutes"
    return 1
}

# Function to get admin access token
get_admin_token() {
    print_info "Getting admin access token..."
    
    local response=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "grant_type=password" \
        -d "client_id=admin-cli" \
        -d "username=${ADMIN_USER}" \
        -d "password=${ADMIN_PASS}")
    
    if [ $? -eq 0 ] && [ -n "$response" ]; then
        echo "$response" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4
    else
        print_error "Failed to get admin token"
        return 1
    fi
}

# Function to check if realm exists
realm_exists() {
    local token=$1
    local response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $token" \
        "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}")
    
    [ "$response" = "200" ]
}

# Function to import realm
import_realm() {
    local token=$1
    print_info "Importing HFP realm configuration..."
    
    local response=$(curl -s -o /tmp/import_response.json -w "%{http_code}" \
        -X POST "${KEYCLOAK_URL}/admin/realms" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d @$(dirname "$0")/realm-config/hfp-realm.json)
    
    if [ "$response" = "201" ]; then
        print_status "Realm imported successfully!"
        return 0
    else
        print_error "Failed to import realm (HTTP $response)"
        if [ -f /tmp/import_response.json ]; then
            cat /tmp/import_response.json
        fi
        return 1
    fi
}

# Function to create test household
create_test_household() {
    local token=$1
    print_info "Creating test household data..."
    
    # Create a test household group for demo purposes
    local group_payload='{
        "name": "Household-550e8400-e29b-41d4-a716-446655440001",
        "path": "/households/550e8400-e29b-41d4-a716-446655440001",
        "attributes": {
            "household_id": ["550e8400-e29b-41d4-a716-446655440001"],
            "household_name": ["Demo Household"]
        }
    }'
    
    curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/groups" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "$group_payload" > /dev/null
    
    print_status "Test household group created"
}

# Function to update client secrets for production
update_client_secrets() {
    local token=$1
    print_warning "Client secrets should be updated for production deployment"
    print_info "Current backend client secret: hfp-backend-secret-change-in-production"
    print_info "Use Keycloak admin console to regenerate secrets before production"
}

# Function to validate configuration
validate_configuration() {
    local token=$1
    print_info "Validating HFP realm configuration..."
    
    # Check if realm exists and is enabled
    local realm_response=$(curl -s -H "Authorization: Bearer $token" \
        "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}")
    
    if echo "$realm_response" | grep -q '"enabled":true'; then
        print_status "✓ Realm is enabled"
    else
        print_error "✗ Realm is not enabled"
        return 1
    fi
    
    # Check if clients exist
    local clients_response=$(curl -s -H "Authorization: Bearer $token" \
        "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients")
    
    if echo "$clients_response" | grep -q '"clientId":"hfp-backend"'; then
        print_status "✓ Backend client exists"
    else
        print_error "✗ Backend client not found"
    fi
    
    if echo "$clients_response" | grep -q '"clientId":"hfp-frontend"'; then
        print_status "✓ Frontend client exists"
    else
        print_error "✗ Frontend client not found"
    fi
    
    # Check if roles exist
    local roles_response=$(curl -s -H "Authorization: Bearer $token" \
        "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/roles")
    
    if echo "$roles_response" | grep -q '"name":"household-admin"'; then
        print_status "✓ HFP roles configured"
    else
        print_error "✗ HFP roles not found"
    fi
    
    return 0
}

# Function to display configuration summary
display_summary() {
    print_status "🎉 HFP Keycloak Configuration Complete!"
    echo
    print_info "=== Configuration Summary ==="
    echo -e "Keycloak URL: ${BLUE}${KEYCLOAK_URL}${NC}"
    echo -e "Realm Name: ${BLUE}${REALM_NAME}${NC}"
    echo -e "Admin Console: ${BLUE}${KEYCLOAK_URL}/admin/${NC}"
    echo
    print_info "=== Test Users ==="
    echo -e "System Admin: ${BLUE}admin@hfp.com${NC} / ${BLUE}admin123${NC}"
    echo -e "Household Admin: ${BLUE}demo@household1.com${NC} / ${BLUE}demo123${NC}"
    echo -e "Household Member: ${BLUE}member@household1.com${NC} / ${BLUE}member123${NC}"
    echo
    print_info "=== Client Configuration ==="
    echo -e "Backend Client ID: ${BLUE}hfp-backend${NC}"
    echo -e "Frontend Client ID: ${BLUE}hfp-frontend${NC}"
    echo
    print_info "=== Security Notes ==="
    print_warning "1. Change default passwords in production"
    print_warning "2. Regenerate client secrets for production"
    print_warning "3. Update redirect URIs for your domain"
    print_warning "4. Configure SSL/TLS for production"
    echo
    print_status "Ready for HFP backend integration! 🚀"
}

# Main execution
main() {
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║                    HFP Keycloak Setup Script                    ║"
    echo "║              Multi-Tenant Authentication Configuration          ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Wait for Keycloak to be ready
    if ! wait_for_keycloak; then
        exit 1
    fi
    
    # Get admin token
    local admin_token
    admin_token=$(get_admin_token)
    if [ $? -ne 0 ] || [ -z "$admin_token" ]; then
        print_error "Failed to authenticate with Keycloak admin"
        exit 1
    fi
    
    print_status "Successfully authenticated with Keycloak admin"
    
    # Check if realm already exists
    if realm_exists "$admin_token"; then
        print_warning "Realm '$REALM_NAME' already exists"
        print_info "Skipping import, proceeding with validation..."
    else
        # Import realm configuration
        if ! import_realm "$admin_token"; then
            exit 1
        fi
        
        # Create test household
        create_test_household "$admin_token"
    fi
    
    # Validate configuration
    if validate_configuration "$admin_token"; then
        print_status "Configuration validation passed"
    else
        print_error "Configuration validation failed"
        exit 1
    fi
    
    # Update client secrets reminder
    update_client_secrets "$admin_token"
    
    # Display summary
    display_summary
}

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi
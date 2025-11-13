import { Controller, Get } from '@nestjs/common';
import { 
  Public, 
  RequireHouseholdAdmin, 
  RequireHouseholdMember, 
  RequireSystemAdmin,
  RequireRoles,
  UserRole
} from '../../libs/auth-placeholder';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Security Test')
@Controller('security-test')
export class SecurityTestController {
  
  @Get('public')
  @Public()
  @ApiOperation({ summary: 'Public endpoint - no auth required' })
  getPublic() {
    return { message: 'This is a public endpoint', timestamp: new Date() };
  }

  @Get('any-user') 
  @ApiOperation({ summary: 'Any authenticated user can access' })
  getAnyUser() {
    return { message: 'Any authenticated user can see this', timestamp: new Date() };
  }

  @Get('household-member')
  @RequireHouseholdMember()
  @ApiOperation({ summary: 'Requires household member role or higher' })
  getHouseholdMember() {
    return { message: 'Household members and above can see this', timestamp: new Date() };
  }

  @Get('household-admin')
  @RequireHouseholdAdmin()
  @ApiOperation({ summary: 'Requires household admin role or higher' })
  getHouseholdAdmin() {
    return { message: 'Household admins and above can see this', timestamp: new Date() };
  }

  @Get('system-admin')
  @RequireSystemAdmin()
  @ApiOperation({ summary: 'Requires system admin role' })
  getSystemAdmin() {
    return { message: 'Only system admins can see this', timestamp: new Date() };
  }

  @Get('custom-roles')
  @RequireRoles(UserRole.HOUSEHOLD_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Custom role requirements example' })
  getCustomRoles() {
    return { 
      message: 'Custom roles: household admin or system admin', 
      timestamp: new Date() 
    };
  }
}
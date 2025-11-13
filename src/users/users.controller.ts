import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import type { CreateUserDto, UpdateUserDto, ChangePasswordDto } from './users.service';
import type { UserQueryOptions } from './repositories/user.repository';
import { UserRole } from './entities/user.entity';
import { HouseholdScoped } from '../../libs/tenant';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HouseholdScoped()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new user',
    description: 'Create a new user within the current household. Only household admins can create users.',
  })
  @ApiCreatedResponse({
    description: 'User created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        role: { type: 'string', enum: Object.values(UserRole) },
        is_active: { type: 'boolean' },
        created_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @HouseholdScoped()
  @ApiOperation({
    summary: 'Get all users in household',
    description: 'Retrieve a paginated list of users within the current household.',
  })
  @ApiQuery({ name: 'search', required: false, description: 'Search term for user name or email' })
  @ApiQuery({ name: 'role', required: false, description: 'Filter by user role', enum: UserRole })
  @ApiQuery({ name: 'is_active', required: false, description: 'Filter by active status', type: Boolean })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 10 })
  @ApiOkResponse({
    description: 'Users retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        users: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              email: { type: 'string', format: 'email' },
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              role: { type: 'string', enum: Object.values(UserRole) },
              is_active: { type: 'boolean' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Household context required' })
  async findAll(@Query() query: UserQueryOptions) {
    return this.usersService.findAll(query);
  }

  @Get('statistics')
  @HouseholdScoped()
  @ApiOperation({
    summary: 'Get user statistics for household',
    description: 'Retrieve statistics about users in the current household.',
  })
  @ApiOkResponse({
    description: 'User statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        active: { type: 'number' },
        inactive: { type: 'number' },
        byRole: {
          type: 'object',
          properties: {
            admin: { type: 'number' },
            household_admin: { type: 'number' },
            member: { type: 'number' },
            viewer: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Household context required' })
  async getStatistics() {
    return this.usersService.getUserStatistics();
  }

  @Get(':id')
  @HouseholdScoped()
  @ApiOperation({
    summary: 'Get user details',
    description: 'Retrieve detailed information about a specific user within the household.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiOkResponse({
    description: 'User details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        role: { type: 'string', enum: Object.values(UserRole) },
        is_active: { type: 'boolean' },
        household: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
          },
        },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @HouseholdScoped()
  @ApiOperation({
    summary: 'Update user',
    description: 'Update user information. Users can update their own profile, admins can update any user.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiOkResponse({
    description: 'User updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        role: { type: 'string', enum: Object.values(UserRole) },
        is_active: { type: 'boolean' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Post(':id/change-password')
  @HouseholdScoped()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Change user password',
    description: 'Change password for a user. Users can change their own password.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiNoContentResponse({ description: 'Password changed successfully' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Current password incorrect or insufficient permissions' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async changePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(id, changePasswordDto);
  }

  @Post(':id/activate')
  @HouseholdScoped()
  @ApiOperation({
    summary: 'Activate user',
    description: 'Activate a user account. Only household admins can activate users.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiOkResponse({
    description: 'User activated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        is_active: { type: 'boolean', example: true },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.activate(id);
  }

  @Post(':id/deactivate')
  @HouseholdScoped()
  @ApiOperation({
    summary: 'Deactivate user',
    description: 'Deactivate a user account. Only household admins can deactivate users.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiOkResponse({
    description: 'User deactivated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        is_active: { type: 'boolean', example: false },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions or cannot deactivate last admin' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.deactivate(id);
  }

  @Post(':id/promote')
  @HouseholdScoped()
  @ApiOperation({
    summary: 'Promote user to household admin',
    description: 'Promote a user to household admin role. Only existing household admins can promote users.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiOkResponse({
    description: 'User promoted successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        role: { type: 'string', enum: [UserRole.HOUSEHOLD_ADMIN] },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async promoteToAdmin(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.promoteToAdmin(id);
  }

  @Post(':id/demote')
  @HouseholdScoped()
  @ApiOperation({
    summary: 'Demote household admin to member',
    description: 'Demote a household admin to regular member role. Cannot demote the last admin.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiOkResponse({
    description: 'User demoted successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        role: { type: 'string', enum: [UserRole.MEMBER] },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions or cannot demote last admin' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async demoteFromAdmin(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.demoteFromAdmin(id);
  }

  @Delete(':id')
  @HouseholdScoped()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete user',
    description: 'Soft delete a user. Only household admins can delete users. Cannot delete the last admin.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiNoContentResponse({ description: 'User deleted successfully' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions or cannot delete last admin' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.remove(id);
  }
}
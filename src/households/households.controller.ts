import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards, 
  Request,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus
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
import { HouseholdsService } from './households.service';
import type { HouseholdQueryOptions } from './households.service';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { UpdateHouseholdDto } from './dto/update-household.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { KeycloakAuthGuard } from '../auth/guards/keycloak-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequireRole } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Households')
@ApiBearerAuth('JWT-auth')
@Controller('households')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HouseholdsController {
  constructor(private readonly householdsService: HouseholdsService) {}

  @Post()
  @RequireRole(UserRole.ADMIN, UserRole.HOUSEHOLD_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new household',
    description: 'Create a new household. Only system admins or household admins can create households.'
  })
  @ApiCreatedResponse({
    description: 'Household created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid household data' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async create(@Body() createHouseholdDto: CreateHouseholdDto, @Request() req: any) {
    return this.householdsService.create(createHouseholdDto, req.user.id);
  }

  @Get()
  @RequireRole(UserRole.ADMIN) // Only system admins can list all households
  @ApiOperation({
    summary: 'Get all households',
    description: 'Retrieve a paginated list of all households. Only system administrators can access this endpoint.'
  })
  @ApiQuery({ name: 'search', required: false, description: 'Search term for household name' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by household status', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 10 })
  @ApiOkResponse({
    description: 'Households retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        households: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
              created_at: { type: 'string', format: 'date-time' }
            }
          }
        },
        meta: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' }
          }
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Only system administrators can access this endpoint' })
  async findAll(@Query() query: any) {
    const options: HouseholdQueryOptions = {
      search: query.search,
      status: query.status,
      page: query.page ? parseInt(query.page.toString(), 10) : 1,
      limit: query.limit ? parseInt(query.limit.toString(), 10) : 10,
    };

    return this.householdsService.findAll(options);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get household details',
    description: 'Retrieve detailed information about a specific household. Users can only access households they belong to.'
  })
  @ApiParam({ name: 'id', description: 'Household UUID' })
  @ApiOkResponse({
    description: 'Household details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
        members: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              email: { type: 'string', format: 'email' },
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              role: { type: 'string', enum: ['HOUSEHOLD_ADMIN', 'MEMBER', 'VIEWER'] }
            }
          }
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Access denied to this household' })
  @ApiNotFoundResponse({ description: 'Household not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string, 
    @Request() req: any
  ) {
    return this.householdsService.findOne(id, req.user.id);
  }

  @Get(':id/stats')
  @ApiOperation({
    summary: 'Get household statistics',
    description: 'Retrieve financial and usage statistics for a household.'
  })
  @ApiParam({ name: 'id', description: 'Household UUID' })
  @ApiOkResponse({
    description: 'Household statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalMembers: { type: 'number' },
        totalAccounts: { type: 'number' },
        totalBalance: { type: 'number' },
        monthlyExpenses: { type: 'number' },
        activeBudgets: { type: 'number' }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Access denied to this household' })
  @ApiNotFoundResponse({ description: 'Household not found' })
  async getHouseholdStats(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any
  ) {
    return this.householdsService.getHouseholdStats(id);
  }

  @Patch(':id')
  @RequireRole(UserRole.ADMIN, UserRole.HOUSEHOLD_ADMIN)
  @ApiOperation({
    summary: 'Update household',
    description: 'Update household information. Only system admins and household admins can update households.'
  })
  @ApiParam({ name: 'id', description: 'Household UUID' })
  @ApiOkResponse({
    description: 'Household updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
        updated_at: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid update data' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Household not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateHouseholdDto: UpdateHouseholdDto,
    @Request() req: any
  ) {
    return this.householdsService.update(id, updateHouseholdDto, req.user.id);
  }

  @Patch(':id/activate')
  @RequireRole(UserRole.ADMIN, UserRole.HOUSEHOLD_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activate household',
    description: 'Activate a household to enable all operations and access.'
  })
  @ApiParam({ name: 'id', description: 'Household UUID' })
  @ApiOkResponse({ description: 'Household activated successfully' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Household not found' })
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.householdsService.activate(id);
  }

  @Patch(':id/deactivate')
  @RequireRole(UserRole.ADMIN, UserRole.HOUSEHOLD_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate household',
    description: 'Deactivate a household to restrict access while maintaining data.'
  })
  @ApiParam({ name: 'id', description: 'Household UUID' })
  @ApiOkResponse({ description: 'Household deactivated successfully' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Household not found' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.householdsService.deactivate(id);
  }

  @Patch(':id/suspend')
  @RequireRole(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Suspend household',
    description: 'Suspend a household due to violations or administrative reasons. Only system administrators can suspend households.'
  })
  @ApiParam({ name: 'id', description: 'Household UUID' })
  @ApiOkResponse({ description: 'Household suspended successfully' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Only system administrators can suspend households' })
  @ApiNotFoundResponse({ description: 'Household not found' })
  async suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.householdsService.suspend(id);
  }

  @Delete(':id')
  @RequireRole(UserRole.ADMIN, UserRole.HOUSEHOLD_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete household',
    description: 'Permanently delete a household and all associated data. This action cannot be undone.'
  })
  @ApiParam({ name: 'id', description: 'Household UUID' })
  @ApiNoContentResponse({ description: 'Household deleted successfully' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Household not found' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string, 
    @Request() req: any
  ) {
    return this.householdsService.remove(id, req.user.id);
  }
}
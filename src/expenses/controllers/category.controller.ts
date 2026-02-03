import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { HouseholdGuard } from '../../shared/guards/household.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { RequireRole } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentHousehold } from '../../shared/decorators/current-household.decorator';
import { User, UserRole } from '../../users/entities/user.entity';
import { CategoryService, CategoryQueryOptions } from '../services/category.service';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto';
import { Category, CategoryType } from '../entities/category.entity';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HouseholdGuard, RolesGuard)
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @ApiOperation({
    summary: 'Create a new category',
    description: 'Create a new expense or income category for organizing transactions.'
  })
  @ApiCreatedResponse({
    description: 'Category created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        category_type: { type: 'string', enum: ['expense', 'income', 'transfer'] },
        color: { type: 'string' },
        icon: { type: 'string' },
        budget_limit: { type: 'number' },
        created_at: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid category data or parent category not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  create(
    @Body() createCategoryDto: CreateCategoryDto,
    @CurrentHousehold() householdId: string,
    @CurrentUser() user: User,
  ): Promise<Category> {
    return this.categoryService.create(createCategoryDto, householdId, user.id);
  }

  @Post('defaults')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN)
  @ApiOperation({
    summary: 'Create default categories',
    description: 'Create a set of default expense and income categories for a new household.'
  })
  @ApiCreatedResponse({
    description: 'Default categories created successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          category_type: { type: 'string' },
          color: { type: 'string' },
          icon: { type: 'string' },
          is_system: { type: 'boolean', default: true }
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Only household administrators can create default categories' })
  createDefaults(
    @CurrentHousehold() householdId: string,
    @CurrentUser() user: User,
  ): Promise<Category[]> {
    return this.categoryService.createDefaultCategories(householdId, user.id);
  }

  @Get()
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({
    summary: 'Get household categories',
    description: 'Retrieve a filtered and paginated list of categories for the current household.'
  })
  @ApiQuery({ name: 'search', required: false, description: 'Search by category name or description' })
  @ApiQuery({ name: 'category_type', required: false, enum: CategoryType, description: 'Filter by category type' })
  @ApiQuery({ name: 'parent_id', required: false, description: 'Filter by parent category ID (use empty string for top-level)' })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean, description: 'Filter by active status' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 50)' })
  @ApiOkResponse({
    description: 'Categories retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              category_type: { type: 'string' },
              color: { type: 'string' },
              icon: { type: 'string' },
              budget_limit: { type: 'number' },
              is_active: { type: 'boolean' },
              sort_order: { type: 'number' },
              parent: { type: 'object' },
              subcategories: { type: 'array', items: { type: 'object' } }
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
  findAll(
    @CurrentHousehold() householdId: string,
    @Query('search') search?: string,
    @Query('category_type') category_type?: CategoryType,
    @Query('parent_id') parent_id?: string,
    @Query('is_active') is_active?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const options: CategoryQueryOptions = {
      search,
      category_type,
      parent_id,
      is_active,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    };
    
    return this.categoryService.findAll(householdId, options);
  }

  @Get('hierarchy')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({
    summary: 'Get category hierarchy',
    description: 'Retrieve categories organized in a hierarchical tree structure with parent-child relationships.'
  })
  @ApiQuery({ name: 'category_type', required: false, enum: CategoryType, description: 'Filter by category type' })
  @ApiOkResponse({
    description: 'Category hierarchy retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          category_type: { type: 'string' },
          color: { type: 'string' },
          icon: { type: 'string' },
          subcategories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                color: { type: 'string' },
                icon: { type: 'string' }
              }
            }
          }
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  getHierarchy(
    @CurrentHousehold() householdId: string,
    @Query('category_type') category_type?: CategoryType,
  ): Promise<Category[]> {
    return this.categoryService.getHierarchy(householdId, category_type);
  }

  @Get(':id')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER, UserRole.VIEWER)
  @ApiOperation({
    summary: 'Get category details',
    description: 'Retrieve detailed information for a specific category including subcategories and parent relationship.'
  })
  @ApiParam({ name: 'id', description: 'Category UUID' })
  @ApiOkResponse({
    description: 'Category details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        description: { type: 'string' },
        category_type: { type: 'string' },
        color: { type: 'string' },
        icon: { type: 'string' },
        is_active: { type: 'boolean' },
        is_system: { type: 'boolean' },
        sort_order: { type: 'number' },
        budget_limit: { type: 'number' },
        budget_period: { type: 'string' },
        parent: { type: 'object' },
        subcategories: { type: 'array', items: { type: 'object' } },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentHousehold() householdId: string,
  ): Promise<Category> {
    return this.categoryService.findOne(id, householdId);
  }

  @Patch(':id')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @ApiOperation({
    summary: 'Update category',
    description: 'Update category details including name, color, icon, budget limits, and parent relationships.'
  })
  @ApiParam({ name: 'id', description: 'Category UUID' })
  @ApiOkResponse({
    description: 'Category updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        category_type: { type: 'string' },
        color: { type: 'string' },
        budget_limit: { type: 'number' },
        updated_at: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid update data or circular reference' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @CurrentHousehold() householdId: string,
    @CurrentUser() user: User,
  ): Promise<Category> {
    return this.categoryService.update(id, householdId, updateCategoryDto, user.id);
  }

  @Delete(':id')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete category',
    description: 'Soft delete a category. Categories with subcategories or associated transactions cannot be deleted.'
  })
  @ApiParam({ name: 'id', description: 'Category UUID' })
  @ApiNoContentResponse({ description: 'Category deleted successfully' })
  @ApiBadRequestResponse({ description: 'Category has subcategories or transactions' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentHousehold() householdId: string,
  ): Promise<void> {
    return this.categoryService.remove(id, householdId);
  }

  @Patch('sort-order')
  @RequireRole(UserRole.HOUSEHOLD_ADMIN, UserRole.MEMBER)
  @ApiOperation({
    summary: 'Update category sort order',
    description: 'Update the display order of multiple categories in a single operation.'
  })
  @ApiOkResponse({
    description: 'Category sort order updated successfully'
  })
  @ApiBadRequestResponse({ description: 'Invalid sort order data' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  updateSortOrder(
    @Body() updates: { id: string; sort_order: number }[],
    @CurrentHousehold() householdId: string,
  ): Promise<void> {
    return this.categoryService.updateSortOrder(householdId, updates);
  }
}
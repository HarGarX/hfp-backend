import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Category, CategoryType } from '../entities/category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto';
import { CategoryRepository } from '../repositories/category.repository';

export interface CategoryQueryOptions {
  search?: string;
  category_type?: CategoryType;
  parent_id?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
}

export interface CategoryWithStats {
  category: Category;
  transactionCount: number;
  totalAmount: number;
  budgetUtilization?: number;
}

@Injectable()
export class CategoryService {
  constructor(
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async create(
    createCategoryDto: CreateCategoryDto,
    householdId: string,
    userId: string,
  ): Promise<Category> {
    // Check for duplicate category name within household
    const existingCategory = await this.categoryRepository.findOneWithHousehold(householdId, {
      where: {
        name: createCategoryDto.name,
      },
    });

    if (existingCategory) {
      throw new ConflictException('Category with this name already exists in household');
    }

    // Validate parent category if provided
    if (createCategoryDto.parent_id) {
      const parentCategory = await this.categoryRepository.findByIdWithHousehold(
        householdId,
        createCategoryDto.parent_id,
      );

      if (!parentCategory) {
        throw new NotFoundException('Parent category not found');
      }

      // Ensure parent and child have same type
      if (parentCategory.category_type !== createCategoryDto.category_type) {
        throw new BadRequestException('Parent and child categories must have the same type');
      }

      // Prevent deep nesting (max 2 levels)
      if (parentCategory.parent_id) {
        throw new BadRequestException('Categories can only be nested one level deep');
      }
    }

    const category = this.categoryRepository.create({
      ...createCategoryDto,
      household_id: householdId,
      created_by: userId,
    });

    return this.categoryRepository.saveWithHousehold(householdId, category);
  }

  async findAll(
    householdId: string,
    options: CategoryQueryOptions = {},
  ): Promise<{ categories: Category[]; meta: any }> {
    const {
      search,
      category_type,
      parent_id,
      is_active,
      page = 1,
      limit = 50,
    } = options;

    const query = this.categoryRepository
      .createQueryBuilderWithHousehold(householdId, 'category')
      .leftJoinAndSelect('category.subcategories', 'subcategories')
      .leftJoinAndSelect('category.parent', 'parent')
      .leftJoinAndSelect('category.created_by_user', 'user')
      .orderBy('category.sort_order', 'ASC')
      .addOrderBy('category.name', 'ASC');

    // Apply filters
    if (search) {
      query.andWhere(
        '(category.name ILIKE :search OR category.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (category_type) {
      query.andWhere('category.category_type = :category_type', { category_type });
    }

    if (parent_id !== undefined) {
      if (parent_id === null || parent_id === '') {
        query.andWhere('category.parent_id IS NULL');
      } else {
        query.andWhere('category.parent_id = :parent_id', { parent_id });
      }
    }

    if (is_active !== undefined) {
      query.andWhere('category.is_active = :is_active', { is_active });
    }

    // Pagination
    const offset = (page - 1) * limit;
    query.skip(offset).take(limit);

    const [categories, total] = await query.getManyAndCount();

    return {
      categories,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, householdId: string): Promise<Category> {
    const category = await this.categoryRepository.findOneWithHousehold(householdId, {
      where: { id },
      relations: ['subcategories', 'parent', 'created_by_user'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(
    id: string,
    householdId: string,
    updateCategoryDto: UpdateCategoryDto,
    userId: string,
  ): Promise<Category> {
    const category = await this.findOne(id, householdId);

    // Check for duplicate name if name is being updated
    if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
      const existingCategory = await this.categoryRepository.findOneWithHousehold(householdId, {
        where: {
          name: updateCategoryDto.name,
        },
      });

      if (existingCategory) {
        throw new ConflictException('Category with this name already exists in household');
      }
    }

    // Validate parent category if being updated
    if (updateCategoryDto.parent_id !== undefined) {
      if (updateCategoryDto.parent_id) {
        const parentCategory = await this.categoryRepository.findByIdWithHousehold(
          householdId,
          updateCategoryDto.parent_id,
        );

        if (!parentCategory) {
          throw new NotFoundException('Parent category not found');
        }

        // Prevent self-reference
        if (parentCategory.id === id) {
          throw new BadRequestException('Category cannot be its own parent');
        }

        // Prevent circular reference
        if (parentCategory.parent_id === id) {
          throw new BadRequestException('Category cannot be a child of its own child');
        }

        // Ensure parent and child have same type
        const categoryType = updateCategoryDto.category_type || category.category_type;
        if (parentCategory.category_type !== categoryType) {
          throw new BadRequestException('Parent and child categories must have the same type');
        }
      }
    }

    Object.assign(category, updateCategoryDto);
    return this.categoryRepository.saveWithHousehold(householdId, category);
  }

  async remove(id: string, householdId: string): Promise<void> {
    const category = await this.findOne(id, householdId);

    // Check if category has subcategories
    const subcategoryCount = await this.categoryRepository.countWithHousehold(householdId, {
      where: { parent_id: id },
    });

    if (subcategoryCount > 0) {
      throw new BadRequestException('Cannot delete category that has subcategories');
    }

    // TODO: Check if category has transactions and handle appropriately
    // For now, we'll do a soft delete
    await this.categoryRepository.softDelete(id);
  }

  async getHierarchy(householdId: string, categoryType?: CategoryType): Promise<Category[]> {
    const query = this.categoryRepository
      .createQueryBuilderWithHousehold(householdId, 'category')
      .leftJoinAndSelect('category.subcategories', 'subcategories')
      .andWhere('category.parent_id IS NULL')
      .andWhere('category.is_active = true')
      .orderBy('category.sort_order', 'ASC')
      .addOrderBy('category.name', 'ASC')
      .addOrderBy('subcategories.sort_order', 'ASC')
      .addOrderBy('subcategories.name', 'ASC');

    if (categoryType) {
      query.andWhere('category.category_type = :categoryType', { categoryType });
    }

    return query.getMany();
  }

  async updateSortOrder(
    householdId: string,
    categoryUpdates: { id: string; sort_order: number }[],
  ): Promise<void> {
    const queryRunner = this.categoryRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const update of categoryUpdates) {
        await queryRunner.manager.update(
          Category,
          { id: update.id, household_id: householdId },
          { sort_order: update.sort_order },
        );
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createDefaultCategories(householdId: string, userId: string): Promise<Category[]> {
    const defaultCategories = [
      // Expense categories
      { name: 'Food & Dining', category_type: CategoryType.EXPENSE, color: '#FF6B6B', icon: 'utensils' },
      { name: 'Transportation', category_type: CategoryType.EXPENSE, color: '#4ECDC4', icon: 'car' },
      { name: 'Shopping', category_type: CategoryType.EXPENSE, color: '#45B7D1', icon: 'shopping-bag' },
      { name: 'Entertainment', category_type: CategoryType.EXPENSE, color: '#96CEB4', icon: 'music' },
      { name: 'Bills & Utilities', category_type: CategoryType.EXPENSE, color: '#FFEAA7', icon: 'file-text' },
      { name: 'Healthcare', category_type: CategoryType.EXPENSE, color: '#DDA0DD', icon: 'heart' },
      { name: 'Education', category_type: CategoryType.EXPENSE, color: '#FFB6C1', icon: 'book' },
      { name: 'Travel', category_type: CategoryType.EXPENSE, color: '#87CEEB', icon: 'plane' },
      
      // Income categories
      { name: 'Salary', category_type: CategoryType.INCOME, color: '#98FB98', icon: 'dollar-sign' },
      { name: 'Freelance', category_type: CategoryType.INCOME, color: '#20B2AA', icon: 'briefcase' },
      { name: 'Investment', category_type: CategoryType.INCOME, color: '#32CD32', icon: 'trending-up' },
      { name: 'Other Income', category_type: CategoryType.INCOME, color: '#90EE90', icon: 'plus' },
    ];

    const categories: Category[] = [];

    for (let i = 0; i < defaultCategories.length; i++) {
      const categoryData = defaultCategories[i];
      const category = this.categoryRepository.create({
        ...categoryData,
        household_id: householdId,
        created_by: userId,
        is_system: true,
        sort_order: i,
      });

      const savedCategory = await this.categoryRepository.saveWithHousehold(householdId, category);
      categories.push(savedCategory);
    }

    return categories;
  }
}
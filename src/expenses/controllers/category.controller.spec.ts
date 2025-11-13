import { Test, TestingModule } from '@nestjs/testing';
import { CategoryController } from './category.controller';
import { CategoryService } from '../services/category.service';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto';
import { Category, CategoryType } from '../entities/category.entity';
import { User, UserRole } from '../../users/entities/user.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('CategoryController', () => {
  let controller: CategoryController;
  let service: jest.Mocked<CategoryService>;

  const mockHouseholdId = 'household-123';
  const mockUserId = 'user-123';

  const mockCategory: Partial<Category> = {
    id: 'category-123',
    name: 'Groceries',
    category_type: CategoryType.EXPENSE,
    color: '#FF5722',
    icon: 'shopping_cart',
    is_active: true,
    is_system: false,
    sort_order: 1,
    budget_limit: 500,
    household_id: mockHouseholdId,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockUser: Partial<User> = {
    id: mockUserId,
    email: 'test@example.com',
    role: UserRole.HOUSEHOLD_ADMIN,
    household_id: mockHouseholdId,
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      createDefaultCategories: jest.fn(),
      findAll: jest.fn(),
      getHierarchy: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      updateSortOrder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [
        {
          provide: CategoryService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<CategoryController>(CategoryController);
    service = module.get(CategoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateCategoryDto = {
      name: 'New Category',
      category_type: CategoryType.EXPENSE,
      color: '#FF5722',
      icon: 'category_icon',
    };

    it('should create a category successfully', async () => {
      service.create.mockResolvedValue(mockCategory as Category);

      const result = await controller.create(createDto, mockHouseholdId, mockUser as User);

      expect(service.create).toHaveBeenCalledWith(createDto, mockHouseholdId, mockUserId);
      expect(result).toEqual(mockCategory);
    });

    it('should handle BadRequestException for invalid parent category', async () => {
      service.create.mockRejectedValue(new BadRequestException('Parent category not found'));

      await expect(controller.create(createDto, mockHouseholdId, mockUser as User)).rejects.toThrow(BadRequestException);
    });
  });

  describe('createDefaults', () => {
    const mockDefaultCategories = [
      { ...mockCategory, name: 'Food & Dining', is_system: true },
      { ...mockCategory, id: 'category-456', name: 'Transportation', is_system: true },
    ];

    it('should create default categories successfully', async () => {
      service.createDefaultCategories.mockResolvedValue(mockDefaultCategories as Category[]);

      const result = await controller.createDefaults(mockHouseholdId, mockUser as User);

      expect(service.createDefaultCategories).toHaveBeenCalledWith(mockHouseholdId, mockUserId);
      expect(result).toEqual(mockDefaultCategories);
    });
  });

  describe('findAll', () => {
    const mockCategoriesResponse = {
      categories: [mockCategory],
      meta: {
        page: 1,
        limit: 50,
        total: 1,
        totalPages: 1,
      },
    };

    it('should return paginated categories with no filters', async () => {
      service.findAll.mockResolvedValue(mockCategoriesResponse as any);

      const result = await controller.findAll(mockHouseholdId);

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, {
        search: undefined,
        category_type: undefined,
        parent_id: undefined,
        is_active: undefined,
        page: undefined,
        limit: undefined,
      });
      expect(result).toEqual(mockCategoriesResponse);
    });

    it('should return paginated categories with all filters', async () => {
      service.findAll.mockResolvedValue(mockCategoriesResponse as any);

      const result = await controller.findAll(
        mockHouseholdId,
        'groceries',
        CategoryType.EXPENSE,
        'parent-123',
        true,
        1,
        10
      );

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, {
        search: 'groceries',
        category_type: CategoryType.EXPENSE,
        parent_id: 'parent-123',
        is_active: true,
        page: 1,
        limit: 10,
      });
      expect(result).toEqual(mockCategoriesResponse);
    });
  });

  describe('getHierarchy', () => {
    const mockHierarchy = [
      {
        ...mockCategory,
        subcategories: [
          { id: 'sub-123', name: 'Organic Food', parent_id: 'category-123' },
          { id: 'sub-456', name: 'Fast Food', parent_id: 'category-123' },
        ],
      },
    ];

    it('should return category hierarchy without filters', async () => {
      service.getHierarchy.mockResolvedValue(mockHierarchy as Category[]);

      const result = await controller.getHierarchy(mockHouseholdId);

      expect(service.getHierarchy).toHaveBeenCalledWith(mockHouseholdId, undefined);
      expect(result).toEqual(mockHierarchy);
    });

    it('should return category hierarchy with type filter', async () => {
      service.getHierarchy.mockResolvedValue(mockHierarchy as Category[]);

      const result = await controller.getHierarchy(mockHouseholdId, CategoryType.EXPENSE);

      expect(service.getHierarchy).toHaveBeenCalledWith(mockHouseholdId, CategoryType.EXPENSE);
      expect(result).toEqual(mockHierarchy);
    });
  });

  describe('findOne', () => {
    it('should return a category by id', async () => {
      service.findOne.mockResolvedValue(mockCategory as Category);

      const result = await controller.findOne('category-123', mockHouseholdId);

      expect(service.findOne).toHaveBeenCalledWith('category-123', mockHouseholdId);
      expect(result).toEqual(mockCategory);
    });

    it('should handle NotFoundException', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Category not found'));

      await expect(controller.findOne('nonexistent-id', mockHouseholdId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateCategoryDto = {
      name: 'Updated Category',
      color: '#4CAF50',
      budget_limit: 600,
    };

    it('should update a category successfully', async () => {
      const updatedCategory = { ...mockCategory, ...updateDto };
      service.update.mockResolvedValue(updatedCategory as Category);

      const result = await controller.update('category-123', updateDto, mockHouseholdId, mockUser as User);

      expect(service.update).toHaveBeenCalledWith('category-123', mockHouseholdId, updateDto, mockUserId);
      expect(result).toEqual(updatedCategory);
    });

    it('should handle NotFoundException', async () => {
      service.update.mockRejectedValue(new NotFoundException('Category not found'));

      await expect(controller.update('nonexistent-id', updateDto, mockHouseholdId, mockUser as User)).rejects.toThrow(NotFoundException);
    });

    it('should handle BadRequestException for circular reference', async () => {
      service.update.mockRejectedValue(new BadRequestException('Circular reference detected'));

      await expect(controller.update('category-123', updateDto, mockHouseholdId, mockUser as User)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove a category successfully', async () => {
      service.remove.mockResolvedValue();

      await controller.remove('category-123', mockHouseholdId);

      expect(service.remove).toHaveBeenCalledWith('category-123', mockHouseholdId);
    });

    it('should handle NotFoundException', async () => {
      service.remove.mockRejectedValue(new NotFoundException('Category not found'));

      await expect(controller.remove('nonexistent-id', mockHouseholdId)).rejects.toThrow(NotFoundException);
    });

    it('should handle BadRequestException for categories with subcategories', async () => {
      service.remove.mockRejectedValue(new BadRequestException('Category has subcategories'));

      await expect(controller.remove('category-123', mockHouseholdId)).rejects.toThrow(BadRequestException);
    });

    it('should handle BadRequestException for categories with transactions', async () => {
      service.remove.mockRejectedValue(new BadRequestException('Category has associated transactions'));

      await expect(controller.remove('category-123', mockHouseholdId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateSortOrder', () => {
    const sortOrderUpdates = [
      { id: 'category-123', sort_order: 1 },
      { id: 'category-456', sort_order: 2 },
      { id: 'category-789', sort_order: 3 },
    ];

    it('should update category sort order successfully', async () => {
      service.updateSortOrder.mockResolvedValue();

      await controller.updateSortOrder(sortOrderUpdates, mockHouseholdId);

      expect(service.updateSortOrder).toHaveBeenCalledWith(mockHouseholdId, sortOrderUpdates);
    });

    it('should handle BadRequestException for invalid sort order data', async () => {
      service.updateSortOrder.mockRejectedValue(new BadRequestException('Invalid sort order data'));

      await expect(controller.updateSortOrder(sortOrderUpdates, mockHouseholdId)).rejects.toThrow(BadRequestException);
    });
  });
});
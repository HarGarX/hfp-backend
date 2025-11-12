import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CategoryService, CategoryQueryOptions } from '../category.service';
import { Category, CategoryType } from '../../entities/category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from '../../dto';

describe('CategoryService', () => {
  let service: CategoryService;
  let categoryRepository: jest.Mocked<Repository<Category>>;

  const mockHouseholdId = 'household-123';
  const mockUserId = 'user-123';
  const mockCategoryId = 'category-123';
  const mockParentCategoryId = 'parent-category-123';

  const mockCategory = {
    id: mockCategoryId,
    household_id: mockHouseholdId,
    name: 'Test Category',
    category_type: CategoryType.EXPENSE,
    color: '#FF0000',
    icon: 'shopping-cart',
    is_active: true,
    is_system: false,
    sort_order: 1,
    created_by: mockUserId,
    created_at: new Date(),
    updated_at: new Date(),
  } as Category;

  const mockParentCategory = {
    id: mockParentCategoryId,
    household_id: mockHouseholdId,
    name: 'Parent Category',
    category_type: CategoryType.EXPENSE,
    color: '#00FF00',
    icon: 'folder',
    is_active: true,
    is_system: false,
    sort_order: 1,
    created_by: mockUserId,
    created_at: new Date(),
    updated_at: new Date(),
    subcategories: [mockCategory],
  } as Category;

  beforeEach(async () => {
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockCategory], 1]),
      getMany: jest.fn().mockResolvedValue([mockCategory]),
      getOne: jest.fn().mockResolvedValue(mockCategory),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        {
          provide: getRepositoryToken(Category),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            softDelete: jest.fn(),
            manager: {
              connection: {
                createQueryRunner: jest.fn().mockReturnValue({
                  connect: jest.fn(),
                  startTransaction: jest.fn(),
                  commitTransaction: jest.fn(),
                  rollbackTransaction: jest.fn(),
                  release: jest.fn(),
                  manager: {
                    update: jest.fn(),
                  },
                }),
              },
            },
          },
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    categoryRepository = module.get(getRepositoryToken(Category));
  });

  describe('create', () => {
    const createCategoryDto: CreateCategoryDto = {
      name: 'Test Category',
      category_type: CategoryType.EXPENSE,
      color: '#FF0000',
      icon: 'shopping-cart',
    };

    it('should create a new category', async () => {
      categoryRepository.findOne.mockResolvedValue(null); // No existing category
      categoryRepository.create.mockReturnValue(mockCategory);
      categoryRepository.save.mockResolvedValue(mockCategory);

      const result = await service.create(createCategoryDto, mockHouseholdId, mockUserId);

      expect(categoryRepository.findOne).toHaveBeenCalledWith({
        where: { 
          household_id: mockHouseholdId, 
          name: createCategoryDto.name 
        },
      });
      expect(categoryRepository.create).toHaveBeenCalledWith({
        ...createCategoryDto,
        household_id: mockHouseholdId,
        created_by: mockUserId,
      });
      expect(categoryRepository.save).toHaveBeenCalledWith(mockCategory);
      expect(result).toEqual(mockCategory);
    });

    it('should throw ConflictException when category name already exists', async () => {
      categoryRepository.findOne.mockResolvedValue(mockCategory);

      await expect(
        service.create(createCategoryDto, mockHouseholdId, mockUserId),
      ).rejects.toThrow(ConflictException);
      expect(categoryRepository.findOne).toHaveBeenCalledWith({
        where: { 
          household_id: mockHouseholdId, 
          name: createCategoryDto.name 
        },
      });
    });

    it('should validate parent category exists when parent_id provided', async () => {
      const createWithParentDto: CreateCategoryDto = {
        ...createCategoryDto,
        parent_id: mockParentCategoryId,
      };

      categoryRepository.findOne
        .mockResolvedValueOnce(null) // No duplicate name
        .mockResolvedValueOnce(mockParentCategory); // Parent exists

      categoryRepository.create.mockReturnValue(mockCategory);
      categoryRepository.save.mockResolvedValue(mockCategory);

      await service.create(createWithParentDto, mockHouseholdId, mockUserId);

      expect(categoryRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException when parent category not found', async () => {
      const createWithParentDto: CreateCategoryDto = {
        ...createCategoryDto,
        parent_id: mockParentCategoryId,
      };

      categoryRepository.findOne
        .mockResolvedValueOnce(null) // No duplicate name
        .mockResolvedValueOnce(null); // Parent doesn't exist

      await expect(
        service.create(createWithParentDto, mockHouseholdId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated categories with default options', async () => {
      const result = await service.findAll(mockHouseholdId, {});

      expect(result).toEqual({
        categories: [mockCategory],
        meta: {
          page: 1,
          limit: 50,
          total: 1,
          totalPages: 1,
        },
      });
    });

    it('should apply search filter', async () => {
      const options: CategoryQueryOptions = {
        search: 'test',
      };

      await service.findAll(mockHouseholdId, options);

      const queryBuilder = categoryRepository.createQueryBuilder();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(category.name ILIKE :search OR category.description ILIKE :search)',
        { search: '%test%' }
      );
    });

    it('should apply category type filter', async () => {
      const options: CategoryQueryOptions = {
        category_type: CategoryType.EXPENSE,
      };

      await service.findAll(mockHouseholdId, options);

      const queryBuilder = categoryRepository.createQueryBuilder();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'category.category_type = :category_type',
        { category_type: CategoryType.EXPENSE }
      );
    });

    it('should filter by parent_id', async () => {
      const options: CategoryQueryOptions = {
        parent_id: mockParentCategoryId,
      };

      await service.findAll(mockHouseholdId, options);

      const queryBuilder = categoryRepository.createQueryBuilder();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'category.parent_id = :parent_id',
        { parent_id: mockParentCategoryId }
      );
    });

    it('should filter top-level categories when parent_id is empty string', async () => {
      const options: CategoryQueryOptions = {
        parent_id: '',
      };

      await service.findAll(mockHouseholdId, options);

      const queryBuilder = categoryRepository.createQueryBuilder();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'category.parent_id IS NULL'
      );
    });
  });

  describe('getHierarchy', () => {
    it('should return category hierarchy', async () => {
      const queryBuilder = categoryRepository.createQueryBuilder();
      (queryBuilder.getMany as jest.Mock).mockResolvedValue([mockParentCategory]);

      const result = await service.getHierarchy(mockHouseholdId);

      expect(categoryRepository.createQueryBuilder).toHaveBeenCalledWith('category');
      expect(result).toEqual([mockParentCategory]);
    });

    it('should filter hierarchy by category type', async () => {
      const queryBuilder = categoryRepository.createQueryBuilder();
      (queryBuilder.getMany as jest.Mock).mockResolvedValue([mockParentCategory]);

      await service.getHierarchy(mockHouseholdId, CategoryType.EXPENSE);

      expect(categoryRepository.createQueryBuilder).toHaveBeenCalledWith('category');
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('category.category_type = :categoryType', { categoryType: CategoryType.EXPENSE });
    });
  });

  describe('findOne', () => {
    it('should return a category by id', async () => {
      categoryRepository.findOne.mockResolvedValue(mockCategory);

      const result = await service.findOne(mockCategoryId, mockHouseholdId);

      expect(categoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockCategoryId, household_id: mockHouseholdId },
        relations: ['subcategories', 'parent', 'created_by_user'],
      });
      expect(result).toEqual(mockCategory);
    });

    it('should throw NotFoundException when category not found', async () => {
      categoryRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne(mockCategoryId, mockHouseholdId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateCategoryDto: UpdateCategoryDto = {
      name: 'Updated Category',
      color: '#0000FF',
    };

    it('should update a category', async () => {
      const updatedCategory = { ...mockCategory, ...updateCategoryDto };
      
      categoryRepository.findOne
        .mockResolvedValueOnce(mockCategory) // Find existing category (called by findOne in update)
        .mockResolvedValueOnce(null); // No duplicate name
      categoryRepository.save.mockResolvedValue(updatedCategory as Category);

      const result = await service.update(
        mockCategoryId,
        mockHouseholdId,
        updateCategoryDto,
        mockUserId,
      );

      expect(categoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockCategoryId, household_id: mockHouseholdId },
        relations: ['subcategories', 'parent', 'created_by_user'],
      });
      expect(categoryRepository.save).toHaveBeenCalledWith({
        ...mockCategory,
        ...updateCategoryDto,
      });
      expect(result).toEqual(updatedCategory);
    });

    it('should throw NotFoundException when category not found', async () => {
      categoryRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update(mockCategoryId, mockHouseholdId, updateCategoryDto, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete a category', async () => {
      const categoryWithoutChildren = { ...mockCategory };
      
      categoryRepository.findOne.mockResolvedValue(categoryWithoutChildren);
      categoryRepository.count.mockResolvedValue(0); // No subcategories
      categoryRepository.softDelete.mockResolvedValue({ affected: 1 } as any);

      await service.remove(mockCategoryId, mockHouseholdId);

      expect(categoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockCategoryId, household_id: mockHouseholdId },
        relations: ['subcategories', 'parent', 'created_by_user'],
      });
      expect(categoryRepository.count).toHaveBeenCalledWith({
        where: { parent_id: mockCategoryId, household_id: mockHouseholdId },
      });
      expect(categoryRepository.softDelete).toHaveBeenCalledWith(mockCategoryId);
    });

    it('should throw NotFoundException when category not found', async () => {
      categoryRepository.findOne.mockResolvedValue(null);

      await expect(
        service.remove(mockCategoryId, mockHouseholdId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createDefaultCategories', () => {
    it('should create default expense and income categories', async () => {
      categoryRepository.save.mockImplementation((categories) => 
        Promise.resolve(Array.isArray(categories) ? categories : [categories]) as any
      );

      const result = await service.createDefaultCategories(mockHouseholdId, mockUserId);

      expect(categoryRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('updateSortOrder', () => {
    it('should update sort order for multiple categories', async () => {
      const updates = [
        { id: mockCategoryId, sort_order: 2 },
      ];

      const mockQueryRunner = categoryRepository.manager.connection.createQueryRunner();

      await service.updateSortOrder(mockHouseholdId, updates);

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        Category,
        { id: mockCategoryId, household_id: mockHouseholdId },
        { sort_order: 2 },
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const updates = [
        { id: 'invalid-id', sort_order: 2 },
      ];

      const mockQueryRunner = categoryRepository.manager.connection.createQueryRunner();
      (mockQueryRunner.manager.update as jest.Mock).mockRejectedValue(new Error('Update failed'));

      await expect(service.updateSortOrder(mockHouseholdId, updates)).rejects.toThrow('Update failed');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
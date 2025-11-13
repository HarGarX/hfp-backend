import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, QueryBuilder, SelectQueryBuilder, Not } from 'typeorm';
import { UserRepository, UserQueryOptions } from '../user.repository';
import { User, UserRole } from '../../entities/user.entity';
import { TenantContextService } from '../../../../libs/tenant';

describe('UserRepository', () => {
  let userRepository: UserRepository;
  let mockRepository: jest.Mocked<Repository<User>>;
  let mockTenantContextService: jest.Mocked<TenantContextService>;

  const mockHouseholdId = '123e4567-e89b-12d3-a456-426614174000';
  const mockUserId = '123e4567-e89b-12d3-a456-426614174001';

  const mockUser = {
    id: mockUserId,
    household_id: mockHouseholdId,
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
    role: UserRole.MEMBER,
    is_active: true,
    keycloak_id: 'keycloak-123',
    password_hash: undefined,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
    household: {
      id: mockHouseholdId,
      name: 'Test Household',
    },
  } as User;

  const createMockQueryBuilder = () => {
    const mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
      getMany: jest.fn().mockResolvedValue([mockUser]),
      getOne: jest.fn().mockResolvedValue(mockUser),
      select: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { user_role: UserRole.ADMIN, count: '1' },
        { user_role: UserRole.MEMBER, count: '2' },
      ]),
    } as unknown as jest.Mocked<SelectQueryBuilder<User>>;

    return mockQueryBuilder;
  };

  beforeEach(async () => {
    const mockQueryBuilder = createMockQueryBuilder();

    mockRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;

    mockTenantContextService = {
      getTenantId: jest.fn(),
    } as unknown as jest.Mocked<TenantContextService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRepository,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
        {
          provide: TenantContextService,
          useValue: mockTenantContextService,
        },
      ],
    }).compile();

    userRepository = module.get<UserRepository>(UserRepository);

    // Mock the inherited methods from BaseTenantRepository
    jest.spyOn(userRepository, 'find').mockResolvedValue([mockUser]);
    jest.spyOn(userRepository, 'findById').mockResolvedValue(mockUser);
    jest.spyOn(userRepository, 'createTenantQueryBuilder').mockReturnValue(mockQueryBuilder);
  });

  it('should be defined', () => {
    expect(userRepository).toBeDefined();
  });

  describe('findByEmail', () => {
    it('should find user by email with tenant context', async () => {
      mockTenantContextService.getTenantId.mockReturnValue(mockHouseholdId);
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await userRepository.findByEmail('test@example.com');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
          household_id: mockHouseholdId,
        },
        relations: ['household'],
      });
      expect(result).toEqual(mockUser);
    });

    it('should find user by email without tenant context (global search)', async () => {
      mockTenantContextService.getTenantId.mockReturnValue(null);
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await userRepository.findByEmail('test@example.com');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        relations: ['household'],
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockTenantContextService.getTenantId.mockReturnValue(mockHouseholdId);
      mockRepository.findOne.mockResolvedValue(null);

      const result = await userRepository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByKeycloakId', () => {
    it('should find user by Keycloak ID with tenant context', async () => {
      mockTenantContextService.getTenantId.mockReturnValue(mockHouseholdId);
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await userRepository.findByKeycloakId('keycloak-123');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          keycloak_id: 'keycloak-123',
          household_id: mockHouseholdId,
        },
        relations: ['household'],
      });
      expect(result).toEqual(mockUser);
    });

    it('should find user by Keycloak ID without tenant context', async () => {
      mockTenantContextService.getTenantId.mockReturnValue(null);
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await userRepository.findByKeycloakId('keycloak-123');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { keycloak_id: 'keycloak-123' },
        relations: ['household'],
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('findAllPaginated', () => {
    it('should return paginated users with default options', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      userRepository.createTenantQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getCount.mockResolvedValue(10);
      mockQueryBuilder.getMany.mockResolvedValue([mockUser]);

      const options: UserQueryOptions = {};
      const result = await userRepository.findAllPaginated(options);

      expect(result).toEqual({
        users: [mockUser],
        total: 10,
        page: 1,
        totalPages: 1,
      });
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('user.household', 'household');
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('user.created_at', 'DESC');
    });

    it('should apply search filter', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      userRepository.createTenantQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      const options: UserQueryOptions = { search: 'John' };
      await userRepository.findAllPaginated(options);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(user.first_name ILIKE :search OR user.last_name ILIKE :search OR user.email ILIKE :search)',
        { search: '%John%' }
      );
    });

    it('should apply role filter', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      userRepository.createTenantQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      const options: UserQueryOptions = { role: UserRole.ADMIN };
      await userRepository.findAllPaginated(options);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('user.role = :role', { role: UserRole.ADMIN });
    });

    it('should apply active status filter', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      userRepository.createTenantQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      const options: UserQueryOptions = { is_active: true };
      await userRepository.findAllPaginated(options);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('user.is_active = :is_active', { is_active: true });
    });

    it('should handle pagination correctly', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      userRepository.createTenantQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getCount.mockResolvedValue(25);

      const options: UserQueryOptions = { page: 3, limit: 5 };
      const result = await userRepository.findAllPaginated(options);

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10); // (3-1) * 5
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);
      expect(result.page).toBe(3);
      expect(result.totalPages).toBe(5); // Math.ceil(25/5)
    });

    it('should apply multiple filters simultaneously', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      userRepository.createTenantQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      const options: UserQueryOptions = {
        search: 'test',
        role: UserRole.MEMBER,
        is_active: false,
        page: 2,
        limit: 20,
      };
      await userRepository.findAllPaginated(options);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(user.first_name ILIKE :search OR user.last_name ILIKE :search OR user.email ILIKE :search)',
        { search: '%test%' }
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('user.role = :role', { role: UserRole.MEMBER });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('user.is_active = :is_active', { is_active: false });
    });
  });

  describe('findByRole', () => {
    it('should find users by role', async () => {
      userRepository.find = jest.fn().mockResolvedValue([mockUser]);

      const result = await userRepository.findByRole(UserRole.ADMIN);

      expect(userRepository.find).toHaveBeenCalledWith({
        where: { role: UserRole.ADMIN },
        relations: ['household'],
      });
      expect(result).toEqual([mockUser]);
    });
  });

  describe('findActiveUsers', () => {
    it('should find active users', async () => {
      userRepository.find = jest.fn().mockResolvedValue([mockUser]);

      const result = await userRepository.findActiveUsers();

      expect(userRepository.find).toHaveBeenCalledWith({
        where: { is_active: true },
        relations: ['household'],
      });
      expect(result).toEqual([mockUser]);
    });
  });

  describe('getUserStatistics', () => {
    it('should return user statistics with tenant context', async () => {
      mockTenantContextService.getTenantId.mockReturnValue(mockHouseholdId);
      
      const mockStatsQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(8), // total, then active
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { user_role: UserRole.ADMIN, count: '2' },
          { user_role: UserRole.MEMBER, count: '8' },
        ]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockStatsQueryBuilder as any);

      const result = await userRepository.getUserStatistics();

      expect(mockStatsQueryBuilder.where).toHaveBeenCalledWith('user.household_id = :tenantId', {
        tenantId: mockHouseholdId,
      });
      expect(result).toEqual({
        total: 10,
        active: 8,
        inactive: 2,
        byRole: {
          [UserRole.ADMIN]: 2,
          [UserRole.MEMBER]: 8,
        },
      });
    });

    it('should throw error when no tenant context for statistics', async () => {
      mockTenantContextService.getTenantId.mockReturnValue(null);

      await expect(userRepository.getUserStatistics()).rejects.toThrow(
        'Tenant context is required for user statistics'
      );
    });
  });

  describe('isEmailUnique', () => {
    it('should check email uniqueness with tenant context', async () => {
      mockTenantContextService.getTenantId.mockReturnValue(mockHouseholdId);
      
      const mockUniqueQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null), // No existing user
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockUniqueQueryBuilder as any);

      const result = await userRepository.isEmailUnique('new@example.com');

      expect(mockUniqueQueryBuilder.where).toHaveBeenCalledWith('user.email = :email', {
        email: 'new@example.com',
      });
      expect(mockUniqueQueryBuilder.andWhere).toHaveBeenCalledWith('user.household_id = :tenantId', {
        tenantId: mockHouseholdId,
      });
      expect(result).toBe(true);
    });

    it('should check email uniqueness excluding specific user', async () => {
      mockTenantContextService.getTenantId.mockReturnValue(mockHouseholdId);
      
      const mockUniqueQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockUniqueQueryBuilder as any);

      const result = await userRepository.isEmailUnique('test@example.com', 'exclude-user-id');

      expect(mockUniqueQueryBuilder.andWhere).toHaveBeenCalledWith('user.id != :excludeUserId', {
        excludeUserId: 'exclude-user-id',
      });
      expect(result).toBe(true);
    });

    it('should return false when email already exists', async () => {
      mockTenantContextService.getTenantId.mockReturnValue(mockHouseholdId);
      
      const mockUniqueQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser), // User exists
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockUniqueQueryBuilder as any);

      const result = await userRepository.isEmailUnique('existing@example.com');

      expect(result).toBe(false);
    });

    it('should check global email uniqueness without tenant context', async () => {
      mockTenantContextService.getTenantId.mockReturnValue(null);
      mockRepository.findOne.mockResolvedValue(null); // No existing user

      const result = await userRepository.isEmailUnique('global@example.com');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'global@example.com' },
      });
      expect(result).toBe(true);
    });

    it('should check global email uniqueness excluding user', async () => {
      mockTenantContextService.getTenantId.mockReturnValue(null);
      mockRepository.findOne.mockResolvedValue(null);

      const result = await userRepository.isEmailUnique('global@example.com', 'exclude-id');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'global@example.com', id: Not('exclude-id') },
      });
      expect(result).toBe(true);
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const updateData = { first_name: 'Jane', last_name: 'Smith' };
      const updatedUser = { ...mockUser, ...updateData };
      
      userRepository.findById = jest.fn()
        .mockResolvedValueOnce(mockUser) // First call for validation
        .mockResolvedValueOnce(updatedUser); // Second call for return
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await userRepository.updateUser(mockUserId, updateData);

      expect(userRepository.findById).toHaveBeenCalledTimes(2);
      expect(mockRepository.update).toHaveBeenCalledWith(
        { id: mockUserId },
        expect.objectContaining({
          ...updateData,
          updated_at: expect.any(Date),
        })
      );
      expect(result).toEqual(updatedUser);
    });

    it('should return null when user does not exist', async () => {
      userRepository.findById = jest.fn().mockResolvedValue(null);

      const result = await userRepository.updateUser('nonexistent-id', { first_name: 'Test' });

      expect(result).toBeNull();
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate user successfully', async () => {
      const deactivatedUser = { ...mockUser, is_active: false };
      userRepository.updateUser = jest.fn().mockResolvedValue(deactivatedUser);

      const result = await userRepository.deactivateUser(mockUserId);

      expect(userRepository.updateUser).toHaveBeenCalledWith(mockUserId, { is_active: false });
      expect(result).toBe(true);
    });

    it('should return false when deactivation fails', async () => {
      userRepository.updateUser = jest.fn().mockResolvedValue(null);

      const result = await userRepository.deactivateUser('nonexistent-id');

      expect(result).toBe(false);
    });
  });

  describe('activateUser', () => {
    it('should activate user successfully', async () => {
      const activatedUser = { ...mockUser, is_active: true };
      userRepository.updateUser = jest.fn().mockResolvedValue(activatedUser);

      const result = await userRepository.activateUser(mockUserId);

      expect(userRepository.updateUser).toHaveBeenCalledWith(mockUserId, { is_active: true });
      expect(result).toBe(true);
    });

    it('should return false when activation fails', async () => {
      userRepository.updateUser = jest.fn().mockResolvedValue(null);

      const result = await userRepository.activateUser('nonexistent-id');

      expect(result).toBe(false);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty search results in pagination', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      userRepository.createTenantQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const result = await userRepository.findAllPaginated({ search: 'nonexistent' });

      expect(result).toEqual({
        users: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });
    });

    it('should handle undefined is_active filter gracefully', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      userRepository.createTenantQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      const options: UserQueryOptions = { is_active: undefined };
      await userRepository.findAllPaginated(options);

      // Should not add the is_active filter when undefined
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
        'user.is_active = :is_active',
        expect.any(Object)
      );
    });

    it('should handle role statistics with missing roles', async () => {
      mockTenantContextService.getTenantId.mockReturnValue(mockHouseholdId);
      
      const mockStatsQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(3),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { user_role: UserRole.MEMBER, count: '5' },
          // Missing ADMIN role in results
        ]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockStatsQueryBuilder as any);

      const result = await userRepository.getUserStatistics();

      expect(result.byRole).toEqual({
        [UserRole.MEMBER]: 5,
      });
      expect(result.byRole[UserRole.ADMIN]).toBeUndefined();
    });
  });
});
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UsersService, CreateUserDto, UpdateUserDto, ChangePasswordDto } from '../../users.service';
import { UserRepository, UserQueryOptions, PaginatedUsers } from '../../repositories/user.repository';
import { TenantContextService } from '../../../../libs/tenant';
import { User, UserRole } from '../../entities/user.entity';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<UserRepository>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
    password_hash: 'hashedPassword123',
    role: UserRole.MEMBER,
    is_active: true,
    household_id: '123e4567-e89b-12d3-a456-426614174000',
    keycloak_id: 'keycloak-123',
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: undefined,
    household: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Test Household',
    },
  } as any;

  const mockHouseholdId = '123e4567-e89b-12d3-a456-426614174000';
  const mockUserId = '123e4567-e89b-12d3-a456-426614174001';

  beforeEach(async () => {
    const mockUserRepository = {
      isEmailUnique: jest.fn(),
      create: jest.fn(),
      findAllPaginated: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByKeycloakId: jest.fn(),
      updateUser: jest.fn(),
      softDelete: jest.fn(),
      activateUser: jest.fn(),
      deactivateUser: jest.fn(),
      findByRole: jest.fn(),
      find: jest.fn(),
      findActiveUsers: jest.fn(),
      getUserStatistics: jest.fn(),
    };

    const mockTenantContextService = {
      getTenantId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
        {
          provide: TenantContextService,
          useValue: mockTenantContextService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get(UserRepository);
    tenantContextService = module.get(TenantContextService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createUserDto: CreateUserDto = {
      email: 'new@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
      password: 'password123',
      role: UserRole.MEMBER,
      is_active: true,
      household_id: mockHouseholdId,
    };

    it('should create a user successfully with password', async () => {
      userRepository.isEmailUnique.mockResolvedValue(true);
      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);
      userRepository.create.mockResolvedValue(mockUser);

      const result = await service.create(createUserDto);

      expect(userRepository.isEmailUnique).toHaveBeenCalledWith('new@example.com');
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(userRepository.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        password_hash: 'hashedPassword',
        household_id: mockHouseholdId,
        role: UserRole.MEMBER,
        is_active: true,
        first_name: 'Jane',
        last_name: 'Doe',
      });
      expect(result).toEqual(mockUser);
    });

    it('should create a user without password', async () => {
      const createUserDtoNoPassword = { ...createUserDto };
      delete createUserDtoNoPassword.password;

      userRepository.isEmailUnique.mockResolvedValue(true);
      userRepository.create.mockResolvedValue(mockUser);

      const result = await service.create(createUserDtoNoPassword);

      expect(mockedBcrypt.hash).not.toHaveBeenCalled();
      expect(userRepository.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        password_hash: undefined,
        household_id: mockHouseholdId,
        role: UserRole.MEMBER,
        is_active: true,
        first_name: 'Jane',
        last_name: 'Doe',
      });
      expect(result).toEqual(mockUser);
    });

    it('should use tenant context household_id when not provided', async () => {
      const createUserDtoNoHousehold = { ...createUserDto };
      delete createUserDtoNoHousehold.household_id;

      userRepository.isEmailUnique.mockResolvedValue(true);
      tenantContextService.getTenantId.mockReturnValue(mockHouseholdId);
      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);
      userRepository.create.mockResolvedValue(mockUser);

      const result = await service.create(createUserDtoNoHousehold);

      expect(tenantContextService.getTenantId).toHaveBeenCalled();
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          household_id: mockHouseholdId,
        }),
      );
      expect(result).toEqual(mockUser);
    });

    it('should set default role to MEMBER if not provided', async () => {
      const createUserDtoNoRole = { ...createUserDto };
      delete createUserDtoNoRole.role;

      userRepository.isEmailUnique.mockResolvedValue(true);
      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);
      userRepository.create.mockResolvedValue(mockUser);

      await service.create(createUserDtoNoRole);

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: UserRole.MEMBER,
        }),
      );
    });

    it('should set default is_active to true if not provided', async () => {
      const createUserDtoNoActive = { ...createUserDto };
      delete createUserDtoNoActive.is_active;

      userRepository.isEmailUnique.mockResolvedValue(true);
      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);
      userRepository.create.mockResolvedValue(mockUser);

      await service.create(createUserDtoNoActive);

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: true,
        }),
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      userRepository.isEmailUnique.mockResolvedValue(false);

      await expect(service.create(createUserDto)).rejects.toThrow(
        new ConflictException('User with this email already exists'),
      );

      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if household context is missing', async () => {
      const createUserDtoNoHousehold = { ...createUserDto };
      delete createUserDtoNoHousehold.household_id;

      userRepository.isEmailUnique.mockResolvedValue(true);
      tenantContextService.getTenantId.mockReturnValue(null);

      await expect(service.create(createUserDtoNoHousehold)).rejects.toThrow(
        new ForbiddenException('Household context is required to create users'),
      );

      expect(userRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    const mockPaginatedUsers: PaginatedUsers = {
      users: [mockUser],
      total: 1,
      page: 1,
      totalPages: 1,
    };

    it('should return paginated users with default options', async () => {
      userRepository.findAllPaginated.mockResolvedValue(mockPaginatedUsers);

      const result = await service.findAll();

      expect(userRepository.findAllPaginated).toHaveBeenCalledWith({});
      expect(result).toEqual(mockPaginatedUsers);
    });

    it('should return paginated users with custom options', async () => {
      const options: UserQueryOptions = {
        page: 2,
        limit: 20,
        role: UserRole.ADMIN,
        is_active: true,
      };

      userRepository.findAllPaginated.mockResolvedValue(mockPaginatedUsers);

      const result = await service.findAll(options);

      expect(userRepository.findAllPaginated).toHaveBeenCalledWith(options);
      expect(result).toEqual(mockPaginatedUsers);
    });
  });

  describe('findOne', () => {
    it('should return a user when found', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      const result = await service.findOne(mockUserId);

      expect(userRepository.findById).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(service.findOne(mockUserId)).rejects.toThrow(
        new NotFoundException('User not found'),
      );
    });
  });

  describe('findByEmail', () => {
    it('should return user when found by email', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(userRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found by email', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByKeycloakId', () => {
    it('should return user when found by keycloak ID', async () => {
      userRepository.findByKeycloakId.mockResolvedValue(mockUser);

      const result = await service.findByKeycloakId('keycloak-123');

      expect(userRepository.findByKeycloakId).toHaveBeenCalledWith('keycloak-123');
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found by keycloak ID', async () => {
      userRepository.findByKeycloakId.mockResolvedValue(null);

      const result = await service.findByKeycloakId('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    const updateUserDto: UpdateUserDto = {
      first_name: 'Jane',
      last_name: 'Smith',
      role: UserRole.ADMIN,
      is_active: false,
    };

    it('should update user successfully', async () => {
      const updatedUser = { ...mockUser, ...updateUserDto };
      userRepository.findById.mockResolvedValue(mockUser);
      userRepository.updateUser.mockResolvedValue(updatedUser);

      // Spy on the service method
      jest.spyOn(service, 'findOne').mockResolvedValue(mockUser);

      const result = await service.update(mockUserId, updateUserDto);

      expect(service.findOne).toHaveBeenCalledWith(mockUserId);
      expect(userRepository.updateUser).toHaveBeenCalledWith(mockUserId, updateUserDto);
      expect(result).toEqual(updatedUser);
    });

    it('should throw NotFoundException when user not found during update', async () => {
      userRepository.findById.mockResolvedValue(mockUser);
      userRepository.updateUser.mockResolvedValue(null);

      await expect(service.update(mockUserId, updateUserDto)).rejects.toThrow(
        new NotFoundException('User not found or access denied'),
      );
    });

    it('should throw NotFoundException when user does not exist for verification', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(service.update(mockUserId, updateUserDto)).rejects.toThrow(
        new NotFoundException('User not found'),
      );

      expect(userRepository.updateUser).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove user successfully', async () => {
      userRepository.findById.mockResolvedValue(mockUser);
      userRepository.softDelete.mockResolvedValue(true);

      await service.remove(mockUserId);

      expect(userRepository.findById).toHaveBeenCalledWith(mockUserId);
      expect(userRepository.softDelete).toHaveBeenCalledWith(mockUserId);
    });

    it('should prevent deleting the last admin user', async () => {
      const adminUser = { ...mockUser, role: UserRole.ADMIN };
      userRepository.findById.mockResolvedValue(adminUser);
      userRepository.findByRole.mockResolvedValue([adminUser]); // Only one admin

      await expect(service.remove(mockUserId)).rejects.toThrow(
        new ConflictException('Cannot delete the last admin user'),
      );

      expect(userRepository.softDelete).not.toHaveBeenCalled();
    });

    it('should prevent deleting the last household admin user', async () => {
      const householdAdminUser = { ...mockUser, role: UserRole.HOUSEHOLD_ADMIN };
      userRepository.findById.mockResolvedValue(householdAdminUser);
      userRepository.findByRole.mockResolvedValue([householdAdminUser]); // Only one household admin

      await expect(service.remove(mockUserId)).rejects.toThrow(
        new ConflictException('Cannot delete the last household_admin user'),
      );

      expect(userRepository.softDelete).not.toHaveBeenCalled();
    });

    it('should allow deleting admin when there are multiple admins', async () => {
      const adminUser = { ...mockUser, role: UserRole.ADMIN };
      const anotherAdmin = { ...mockUser, id: 'another-id', role: UserRole.ADMIN };
      userRepository.findById.mockResolvedValue(adminUser);
      userRepository.findByRole.mockResolvedValue([adminUser, anotherAdmin]);
      userRepository.softDelete.mockResolvedValue(true);

      await service.remove(mockUserId);

      expect(userRepository.softDelete).toHaveBeenCalledWith(mockUserId);
    });

    it('should throw ForbiddenException when deletion fails', async () => {
      userRepository.findById.mockResolvedValue(mockUser);
      userRepository.softDelete.mockResolvedValue(false);

      await expect(service.remove(mockUserId)).rejects.toThrow(
        new ForbiddenException('Access denied or user not found'),
      );
    });
  });

  describe('activate', () => {
    it('should activate user successfully', async () => {
      const activatedUser = { ...mockUser, is_active: true };
      userRepository.activateUser.mockResolvedValue(true);
      userRepository.findById.mockResolvedValue(activatedUser);

      const result = await service.activate(mockUserId);

      expect(userRepository.activateUser).toHaveBeenCalledWith(mockUserId);
      expect(userRepository.findById).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(activatedUser);
    });

    it('should throw NotFoundException when activation fails', async () => {
      userRepository.activateUser.mockResolvedValue(false);

      await expect(service.activate(mockUserId)).rejects.toThrow(
        new NotFoundException('User not found or access denied'),
      );
    });
  });

  describe('deactivate', () => {
    it('should deactivate user successfully', async () => {
      const deactivatedUser = { ...mockUser, is_active: false };
      userRepository.findById.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(deactivatedUser);
      userRepository.deactivateUser.mockResolvedValue(true);

      const result = await service.deactivate(mockUserId);

      expect(userRepository.deactivateUser).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(deactivatedUser);
    });

    it('should prevent deactivating the last active admin user', async () => {
      const adminUser = { ...mockUser, role: UserRole.ADMIN, is_active: true };
      userRepository.findById.mockResolvedValue(adminUser);
      userRepository.find.mockResolvedValue([adminUser]); // Only one active admin

      await expect(service.deactivate(mockUserId)).rejects.toThrow(
        new ConflictException('Cannot deactivate the last active admin user'),
      );

      expect(userRepository.deactivateUser).not.toHaveBeenCalled();
    });

    it('should prevent deactivating the last active household admin user', async () => {
      const householdAdminUser = { ...mockUser, role: UserRole.HOUSEHOLD_ADMIN, is_active: true };
      userRepository.findById.mockResolvedValue(householdAdminUser);
      userRepository.find.mockResolvedValue([householdAdminUser]); // Only one active household admin

      await expect(service.deactivate(mockUserId)).rejects.toThrow(
        new ConflictException('Cannot deactivate the last active household_admin user'),
      );

      expect(userRepository.deactivateUser).not.toHaveBeenCalled();
    });

    it('should allow deactivating admin when there are multiple active admins', async () => {
      const adminUser = { ...mockUser, role: UserRole.ADMIN, is_active: true };
      const anotherActiveAdmin = { ...mockUser, id: 'another-id', role: UserRole.ADMIN, is_active: true };
      const deactivatedUser = { ...adminUser, is_active: false };

      userRepository.findById.mockResolvedValueOnce(adminUser).mockResolvedValueOnce(deactivatedUser);
      userRepository.find.mockResolvedValue([adminUser, anotherActiveAdmin]);
      userRepository.deactivateUser.mockResolvedValue(true);

      const result = await service.deactivate(mockUserId);

      expect(userRepository.deactivateUser).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(deactivatedUser);
    });

    it('should throw NotFoundException when deactivation fails', async () => {
      userRepository.findById.mockResolvedValue(mockUser);
      userRepository.deactivateUser.mockResolvedValue(false);

      await expect(service.deactivate(mockUserId)).rejects.toThrow(
        new NotFoundException('User not found or access denied'),
      );
    });
  });

  describe('changePassword', () => {
    const changePasswordDto: ChangePasswordDto = {
      currentPassword: 'oldPassword',
      newPassword: 'newPassword123',
    };

    it('should change password successfully', async () => {
      const userWithPassword = { ...mockUser, password_hash: 'oldPasswordHash' };
      userRepository.findById.mockResolvedValue(userWithPassword);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedBcrypt.hash.mockResolvedValue('newPasswordHash' as never);
      userRepository.updateUser.mockResolvedValue(userWithPassword);

      await service.changePassword(mockUserId, changePasswordDto);

      expect(userRepository.findById).toHaveBeenCalledWith(mockUserId);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith('oldPassword', 'oldPasswordHash');
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('newPassword123', 12);
      expect(userRepository.updateUser).toHaveBeenCalledWith(mockUserId, {
        password_hash: 'newPasswordHash',
      });
    });

    it('should change password for user without existing password', async () => {
      const userWithoutPassword = { ...mockUser, password_hash: undefined };
      userRepository.findById.mockResolvedValue(userWithoutPassword);
      mockedBcrypt.hash.mockResolvedValue('newPasswordHash' as never);
      userRepository.updateUser.mockResolvedValue(userWithoutPassword);

      await service.changePassword(mockUserId, changePasswordDto);

      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('newPassword123', 12);
      expect(userRepository.updateUser).toHaveBeenCalledWith(mockUserId, {
        password_hash: 'newPasswordHash',
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(service.changePassword(mockUserId, changePasswordDto)).rejects.toThrow(
        new NotFoundException('User not found'),
      );

      expect(userRepository.updateUser).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when current password is incorrect', async () => {
      const userWithPassword = { ...mockUser, password_hash: 'oldPasswordHash' };
      userRepository.findById.mockResolvedValue(userWithPassword);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(service.changePassword(mockUserId, changePasswordDto)).rejects.toThrow(
        new ForbiddenException('Current password is incorrect'),
      );

      expect(userRepository.updateUser).not.toHaveBeenCalled();
    });
  });

  describe('getUsersByRole', () => {
    it('should return users by role', async () => {
      const adminUsers = [{ ...mockUser, role: UserRole.ADMIN }];
      userRepository.findByRole.mockResolvedValue(adminUsers);

      const result = await service.getUsersByRole(UserRole.ADMIN);

      expect(userRepository.findByRole).toHaveBeenCalledWith(UserRole.ADMIN);
      expect(result).toEqual(adminUsers);
    });
  });

  describe('getActiveUsers', () => {
    it('should return active users', async () => {
      const activeUsers = [mockUser];
      userRepository.findActiveUsers.mockResolvedValue(activeUsers);

      const result = await service.getActiveUsers();

      expect(userRepository.findActiveUsers).toHaveBeenCalled();
      expect(result).toEqual(activeUsers);
    });
  });

  describe('getUserStatistics', () => {
    it('should return user statistics', async () => {
      const mockStats = { total: 10, active: 8, inactive: 2, byRole: { admin: 2, member: 8 } };
      userRepository.getUserStatistics.mockResolvedValue(mockStats);

      const result = await service.getUserStatistics();

      expect(userRepository.getUserStatistics).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  describe('promoteToAdmin', () => {
    it('should promote user to admin', async () => {
      const promotedUser = { ...mockUser, role: UserRole.HOUSEHOLD_ADMIN };
      userRepository.findById.mockResolvedValue(mockUser);
      userRepository.updateUser.mockResolvedValue(promotedUser);

      const result = await service.promoteToAdmin(mockUserId);

      expect(userRepository.updateUser).toHaveBeenCalledWith(mockUserId, { role: UserRole.HOUSEHOLD_ADMIN });
      expect(result).toEqual(promotedUser);
    });
  });

  describe('demoteFromAdmin', () => {
    it('should demote admin to member successfully', async () => {
      const adminUser = { ...mockUser, role: UserRole.HOUSEHOLD_ADMIN };
      const anotherAdmin = { ...mockUser, id: 'another-id', role: UserRole.HOUSEHOLD_ADMIN };
      const demotedUser = { ...adminUser, role: UserRole.MEMBER };

      userRepository.findById.mockResolvedValueOnce(adminUser).mockResolvedValueOnce(demotedUser);
      userRepository.findByRole.mockResolvedValue([adminUser, anotherAdmin]);
      userRepository.updateUser.mockResolvedValue(demotedUser);

      const result = await service.demoteFromAdmin(mockUserId);

      expect(userRepository.updateUser).toHaveBeenCalledWith(mockUserId, { role: UserRole.MEMBER });
      expect(result).toEqual(demotedUser);
    });

    it('should prevent demoting the last household admin', async () => {
      const householdAdminUser = { ...mockUser, role: UserRole.HOUSEHOLD_ADMIN };
      userRepository.findById.mockResolvedValue(householdAdminUser);
      userRepository.findByRole.mockResolvedValue([householdAdminUser]); // Only one admin

      await expect(service.demoteFromAdmin(mockUserId)).rejects.toThrow(
        new ConflictException('Cannot demote the last household admin'),
      );

      expect(userRepository.updateUser).not.toHaveBeenCalled();
    });

    it('should allow demoting non-admin users', async () => {
      const memberUser = { ...mockUser, role: UserRole.MEMBER };
      const demotedUser = { ...memberUser, role: UserRole.MEMBER };

      userRepository.findById.mockResolvedValueOnce(memberUser).mockResolvedValueOnce(demotedUser);
      userRepository.updateUser.mockResolvedValue(demotedUser);

      const result = await service.demoteFromAdmin(mockUserId);

      expect(userRepository.findByRole).not.toHaveBeenCalled(); // Should not check for last admin if not admin
      expect(result).toEqual(demotedUser);
    });
  });

  describe('assignToHousehold', () => {
    const newHouseholdId = 'new-household-id';

    it('should assign user to household successfully', async () => {
      const reassignedUser = { ...mockUser, household_id: newHouseholdId };
      tenantContextService.getTenantId.mockReturnValue(null); // System admin context
      userRepository.updateUser.mockResolvedValue(reassignedUser);

      const result = await service.assignToHousehold(mockUserId, newHouseholdId);

      expect(userRepository.updateUser).toHaveBeenCalledWith(mockUserId, { household_id: newHouseholdId });
      expect(result).toEqual(reassignedUser);
    });

    it('should allow assignment when tenant context matches household', async () => {
      const reassignedUser = { ...mockUser, household_id: mockHouseholdId };
      tenantContextService.getTenantId.mockReturnValue(mockHouseholdId);
      userRepository.updateUser.mockResolvedValue(reassignedUser);

      const result = await service.assignToHousehold(mockUserId, mockHouseholdId);

      expect(result).toEqual(reassignedUser);
    });

    it('should throw ForbiddenException when tenant context does not match household', async () => {
      tenantContextService.getTenantId.mockReturnValue(mockHouseholdId);

      await expect(service.assignToHousehold(mockUserId, 'different-household-id')).rejects.toThrow(
        new ForbiddenException('Cannot assign user to different household'),
      );

      expect(userRepository.updateUser).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user assignment fails', async () => {
      tenantContextService.getTenantId.mockReturnValue(null);
      userRepository.updateUser.mockResolvedValue(null);

      await expect(service.assignToHousehold(mockUserId, newHouseholdId)).rejects.toThrow(
        new NotFoundException('User not found or access denied'),
      );
    });
  });

  describe('validateCredentials', () => {
    it('should return user when credentials are valid', async () => {
      const userWithPassword = { ...mockUser, password_hash: 'hashedPassword', is_active: true };
      userRepository.findByEmail.mockResolvedValue(userWithPassword);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.validateCredentials('test@example.com', 'password123');

      expect(userRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockedBcrypt.compare).toHaveBeenCalledWith('password123', 'hashedPassword');
      expect(result).toEqual(userWithPassword);
    });

    it('should return null when user not found', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      const result = await service.validateCredentials('nonexistent@example.com', 'password123');

      expect(result).toBeNull();
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return null when user has no password hash', async () => {
      const userWithoutPassword = { ...mockUser, password_hash: undefined, is_active: true };
      userRepository.findByEmail.mockResolvedValue(userWithoutPassword);

      const result = await service.validateCredentials('test@example.com', 'password123');

      expect(result).toBeNull();
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return null when user is inactive', async () => {
      const inactiveUser = { ...mockUser, password_hash: 'hashedPassword', is_active: false };
      userRepository.findByEmail.mockResolvedValue(inactiveUser);

      const result = await service.validateCredentials('test@example.com', 'password123');

      expect(result).toBeNull();
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return null when password is invalid', async () => {
      const userWithPassword = { ...mockUser, password_hash: 'hashedPassword', is_active: true };
      userRepository.findByEmail.mockResolvedValue(userWithPassword);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      const result = await service.validateCredentials('test@example.com', 'wrongPassword');

      expect(mockedBcrypt.compare).toHaveBeenCalledWith('wrongPassword', 'hashedPassword');
      expect(result).toBeNull();
    });
  });
});
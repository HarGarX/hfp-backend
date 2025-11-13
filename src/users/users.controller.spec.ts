import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService, CreateUserDto, UpdateUserDto, ChangePasswordDto } from './users.service';
import { User, UserRole } from './entities/user.entity';
import { NotFoundException, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  const mockUser: Partial<User> = {
    id: 'user-123',
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
    role: UserRole.MEMBER,
    is_active: true,
    household_id: 'household-123',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      changePassword: jest.fn(),
      getUserStatistics: jest.fn(),
      activate: jest.fn(),
      deactivate: jest.fn(),
      promoteToAdmin: jest.fn(),
      demoteFromAdmin: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateUserDto = {
      email: 'newuser@example.com',
      password: 'password123',
      first_name: 'Jane',
      last_name: 'Smith',
      role: UserRole.MEMBER,
      household_id: 'household-123',
    };

    it('should create a user successfully', async () => {
      service.create.mockResolvedValue(mockUser as User);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockUser);
    });

    it('should handle ConflictException for duplicate email', async () => {
      service.create.mockRejectedValue(new ConflictException('User with this email already exists'));

      await expect(controller.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('should handle BadRequestException for invalid data', async () => {
      service.create.mockRejectedValue(new BadRequestException('Invalid user data'));

      await expect(controller.create(createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    const mockUsersResponse = {
      users: [mockUser],
      total: 1,
      page: 1,
      totalPages: 1,
    };

    it('should return paginated users with no filters', async () => {
      service.findAll.mockResolvedValue(mockUsersResponse as any);

      const result = await controller.findAll({});

      expect(service.findAll).toHaveBeenCalledWith({});
      expect(result).toEqual(mockUsersResponse);
    });

    it('should return paginated users with filters', async () => {
      const queryOptions = {
        search: 'john',
        role: UserRole.MEMBER,
        is_active: true,
        page: 1,
        limit: 10,
      };

      service.findAll.mockResolvedValue(mockUsersResponse as any);

      const result = await controller.findAll(queryOptions);

      expect(service.findAll).toHaveBeenCalledWith(queryOptions);
      expect(result).toEqual(mockUsersResponse);
    });
  });

  describe('getStatistics', () => {
    const mockStats = {
      total: 10,
      active: 8,
      inactive: 2,
      byRole: {
        admin: 1,
        household_admin: 2,
        member: 6,
        viewer: 1,
      },
    };

    it('should return user statistics', async () => {
      service.getUserStatistics.mockResolvedValue(mockStats);

      const result = await controller.getStatistics();

      expect(service.getUserStatistics).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      service.findOne.mockResolvedValue(mockUser as User);

      const result = await controller.findOne('user-123');

      expect(service.findOne).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockUser);
    });

    it('should handle NotFoundException', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateUserDto = {
      first_name: 'Updated John',
      last_name: 'Updated Doe',
    };

    it('should update a user successfully', async () => {
      const updatedUser = { ...mockUser, ...updateDto };
      service.update.mockResolvedValue(updatedUser as User);

      const result = await controller.update('user-123', updateDto);

      expect(service.update).toHaveBeenCalledWith('user-123', updateDto);
      expect(result).toEqual(updatedUser);
    });

    it('should handle NotFoundException', async () => {
      service.update.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.update('nonexistent-id', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('changePassword', () => {
    const changePasswordDto: ChangePasswordDto = {
      currentPassword: 'oldpassword',
      newPassword: 'newpassword123',
    };

    it('should change password successfully', async () => {
      service.changePassword.mockResolvedValue();

      await controller.changePassword('user-123', changePasswordDto);

      expect(service.changePassword).toHaveBeenCalledWith('user-123', changePasswordDto);
    });

    it('should handle UnauthorizedException for wrong current password', async () => {
      service.changePassword.mockRejectedValue(new UnauthorizedException('Current password is incorrect'));

      await expect(controller.changePassword('user-123', changePasswordDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should handle NotFoundException', async () => {
      service.changePassword.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.changePassword('nonexistent-id', changePasswordDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('promoteToAdmin', () => {
    it('should promote user to admin successfully', async () => {
      const updatedUser = { ...mockUser, role: UserRole.HOUSEHOLD_ADMIN };
      service.promoteToAdmin.mockResolvedValue(updatedUser as User);

      const result = await controller.promoteToAdmin('user-123');

      expect(service.promoteToAdmin).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(updatedUser);
    });

    it('should handle NotFoundException', async () => {
      service.promoteToAdmin.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.promoteToAdmin('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('demoteFromAdmin', () => {
    it('should demote user from admin successfully', async () => {
      const updatedUser = { ...mockUser, role: UserRole.MEMBER };
      service.demoteFromAdmin.mockResolvedValue(updatedUser as User);

      const result = await controller.demoteFromAdmin('user-123');

      expect(service.demoteFromAdmin).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(updatedUser);
    });

    it('should handle ConflictException when trying to demote last admin', async () => {
      service.demoteFromAdmin.mockRejectedValue(new ConflictException('Cannot demote the last household admin'));

      await expect(controller.demoteFromAdmin('user-123')).rejects.toThrow(ConflictException);
    });
  });

  describe('activate', () => {
    it('should activate user successfully', async () => {
      const activeUser = { ...mockUser, is_active: true };
      service.activate.mockResolvedValue(activeUser as User);

      const result = await controller.activate('user-123');

      expect(service.activate).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(activeUser);
    });

    it('should handle NotFoundException', async () => {
      service.activate.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.activate('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('should deactivate user successfully', async () => {
      const inactiveUser = { ...mockUser, is_active: false };
      service.deactivate.mockResolvedValue(inactiveUser as User);

      const result = await controller.deactivate('user-123');

      expect(service.deactivate).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(inactiveUser);
    });

    it('should handle NotFoundException', async () => {
      service.deactivate.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.deactivate('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a user successfully', async () => {
      service.remove.mockResolvedValue();

      await controller.remove('user-123');

      expect(service.remove).toHaveBeenCalledWith('user-123');
    });

    it('should handle NotFoundException', async () => {
      service.remove.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.remove('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('should handle ConflictException when user is last admin', async () => {
      service.remove.mockRejectedValue(new ConflictException('Cannot remove the last household admin'));

      await expect(controller.remove('user-123')).rejects.toThrow(ConflictException);
    });
  });
});
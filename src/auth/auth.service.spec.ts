import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { Household, HouseholdStatus } from '../households/entities/household.entity';

// Mock Repository class
class MockRepository<T> {
  findOneBy = jest.fn();
  findOne = jest.fn();
  save = jest.fn();
  create = jest.fn();
  find = jest.fn();
}

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: MockRepository<User>;
  let householdsRepository: MockRepository<Household>;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useClass: MockRepository,
        },
        {
          provide: getRepositoryToken(Household),
          useClass: MockRepository,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    householdsRepository = module.get(getRepositoryToken(Household));
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('validateUser', () => {
    it('should return user data when credentials are valid', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        password_hash: await bcrypt.hash('password123', 12),
        first_name: 'Test',
        last_name: 'User',
        role: UserRole.MEMBER,
        household_id: 'household-123',
        household: { id: 'household-123', name: 'Test Household' },
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toBeDefined();
      expect(result.email).toBe('test@example.com');
      expect(result.password_hash).toBeUndefined(); // Should be excluded
    });

    it('should return null when user does not exist', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      const result = await service.validateUser('nonexistent@example.com', 'password');

      expect(result).toBeNull();
    });

    it('should return null when password is incorrect', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        password_hash: await bcrypt.hash('correctpassword', 12),
        first_name: 'Test',
        last_name: 'User',
        role: UserRole.MEMBER,
        household_id: 'household-123',
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);

      const result = await service.validateUser('test@example.com', 'wrongpassword');

      expect(result).toBeNull();
    });

    it('should return null when user has no password hash (Keycloak user)', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        password_hash: null,
        keycloak_id: 'keycloak-123',
        first_name: 'Test',
        last_name: 'User',
        role: UserRole.MEMBER,
        household_id: 'household-123',
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access token and user data for valid credentials', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        role: UserRole.MEMBER,
        household_id: 'household-123',
      };

      jest.spyOn(service, 'validateUser').mockResolvedValue(mockUser);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toBeDefined();
      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user).toEqual(mockUser);
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        household_id: mockUser.household_id,
        role: mockUser.role,
      });
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      jest.spyOn(service, 'validateUser').mockResolvedValue(null);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrongpassword' })
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('should create new user and household successfully', async () => {
      const registerDto: RegisterDto = {
        email: 'newuser@example.com',
        password: 'password123',
        first_name: 'New',
        last_name: 'User',
        household_name: 'New Household',
      };

      const mockHousehold = {
        id: 'household-123',
        name: 'New Household',
        status: HouseholdStatus.ACTIVE,
        default_currency: 'USD',
        member_count: 0,
        total_income: 0,
        total_expenses: 0,
      };

      const mockUser = {
        id: 'user-123',
        email: 'newuser@example.com',
        first_name: 'New',
        last_name: 'User',
        role: UserRole.MEMBER,
        household_id: 'household-123',
        household: mockHousehold,
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null); // User doesn't exist
      jest.spyOn(householdsRepository, 'create').mockReturnValue(mockHousehold as any);
      jest.spyOn(householdsRepository, 'save').mockResolvedValue(mockHousehold as any);
      jest.spyOn(userRepository, 'create').mockReturnValue(mockUser as any);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser as any);
      jest.spyOn(service, 'hashPassword').mockResolvedValue('hashed-password');

      const result = await service.register(registerDto);

      expect(result).toBeDefined();
      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user.email).toBe('newuser@example.com');
      expect(householdsRepository.create).toHaveBeenCalledWith({
        name: 'New Household',
      });
      expect(userRepository.create).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password_hash: 'hashed-password',
        first_name: 'New',
        last_name: 'User',
        role: UserRole.HOUSEHOLD_ADMIN,
        household_id: 'household-123',
        household: mockHousehold,
      });
    });

    it('should use default household when no household_name provided', async () => {
      const registerDto: RegisterDto = {
        email: 'newuser@example.com',
        password: 'password123',
        first_name: 'New',
        last_name: 'User',
      };

      const mockDefaultHousehold = {
        id: 'default-household-123',
        name: 'Default Household',
        status: HouseholdStatus.ACTIVE,
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(householdsRepository, 'findOne').mockResolvedValue(mockDefaultHousehold as any);
      jest.spyOn(userRepository, 'create').mockReturnValue({} as any);
      jest.spyOn(userRepository, 'save').mockResolvedValue({
        id: 'user-123',
        email: 'newuser@example.com',
        household_id: 'default-household-123',
      } as any);
      jest.spyOn(service, 'hashPassword').mockResolvedValue('hashed-password');

      await service.register(registerDto);

      expect(householdsRepository.findOne).toHaveBeenCalledWith({
        where: { name: 'Default Household' }
      });
    });

    it('should throw ConflictException when user already exists', async () => {
      const registerDto: RegisterDto = {
        email: 'existing@example.com',
        password: 'password123',
        first_name: 'Existing',
        last_name: 'User',
      };

      const existingUser = { id: '123', email: 'existing@example.com' };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(existingUser as any);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'existing@example.com' }
      });
    });
  });

  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      const password = 'testpassword123';
      const hashedPassword = await service.hashPassword(password);

      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(await bcrypt.compare(password, hashedPassword)).toBe(true);
    });
  });
});
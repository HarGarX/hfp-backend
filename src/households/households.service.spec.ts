import { Test, TestingModule } from '@nestjs/testing';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';

import { HouseholdsService } from './households.service';
import { Household, HouseholdStatus } from './entities/household.entity';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { UpdateHouseholdDto } from './dto/update-household.dto';

// Mock QueryBuilder
class MockQueryBuilder {
  where = jest.fn().mockReturnThis();
  andWhere = jest.fn().mockReturnThis();
  orderBy = jest.fn().mockReturnThis();
  skip = jest.fn().mockReturnThis();
  take = jest.fn().mockReturnThis();
  getManyAndCount = jest.fn();
}

// Mock Repository class
class MockRepository<T> {
  findOneBy = jest.fn();
  findOne = jest.fn();
  save = jest.fn();
  create = jest.fn();
  find = jest.fn();
  remove = jest.fn();
  softDelete = jest.fn();
  increment = jest.fn();
  update = jest.fn();
  createQueryBuilder = jest.fn().mockReturnValue(new MockQueryBuilder());
}

describe('HouseholdsService', () => {
  let service: HouseholdsService;
  let repository: MockRepository<Household>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HouseholdsService,
        {
          provide: getRepositoryToken(Household),
          useClass: MockRepository,
        },
      ],
    }).compile();

    service = module.get<HouseholdsService>(HouseholdsService);
    repository = module.get(getRepositoryToken(Household));
  });

  describe('create', () => {
    it('should create a new household successfully', async () => {
      const createDto: CreateHouseholdDto = {
        name: 'Test Household',
        description: 'Test description',
        default_currency: 'EUR',
      };

      const mockHousehold = {
        id: 'household-123',
        name: 'Test Household',
        description: 'Test description',
        status: HouseholdStatus.ACTIVE,
        default_currency: 'EUR',
        member_count: 0,
        total_income: 0,
        total_expenses: 0,
      };

      jest.spyOn(repository, 'findOne').mockResolvedValue(null); // No existing household
      jest.spyOn(repository, 'create').mockReturnValue(mockHousehold as any);
      jest.spyOn(repository, 'save').mockResolvedValue(mockHousehold as any);

      const result = await service.create(createDto);

      expect(result).toEqual(mockHousehold);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { name: 'Test Household' }
      });
      expect(repository.create).toHaveBeenCalledWith({
        ...createDto,
        status: HouseholdStatus.ACTIVE,
        default_currency: 'EUR',
        member_count: 0,
        total_income: 0,
        total_expenses: 0,
      });
    });

    it('should throw ConflictException when household with same name exists', async () => {
      const createDto: CreateHouseholdDto = {
        name: 'Existing Household',
      };

      const existingHousehold = { id: '123', name: 'Existing Household' };
      jest.spyOn(repository, 'findOne').mockResolvedValue(existingHousehold as any);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { name: 'Existing Household' }
      });
    });

    it('should use default values for optional fields', async () => {
      const createDto: CreateHouseholdDto = {
        name: 'Simple Household',
      };

      jest.spyOn(repository, 'findOne').mockResolvedValue(null);
      jest.spyOn(repository, 'create').mockReturnValue({} as any);
      jest.spyOn(repository, 'save').mockResolvedValue({} as any);

      await service.create(createDto);

      expect(repository.create).toHaveBeenCalledWith({
        name: 'Simple Household',
        status: HouseholdStatus.ACTIVE,
        default_currency: 'USD',
        member_count: 0,
        total_income: 0,
        total_expenses: 0,
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated households with default options', async () => {
      const mockHouseholds = [
        { id: '1', name: 'Household 1', status: HouseholdStatus.ACTIVE },
        { id: '2', name: 'Household 2', status: HouseholdStatus.ACTIVE },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockHouseholds, 2]),
      };

      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAll();

      expect(result).toEqual({
        households: mockHouseholds,
        total: 2,
        page: 1,
        totalPages: 1,
      });
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should apply search filter when provided', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      await service.findAll({ search: 'test search' });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        '(household.name ILIKE :search OR household.description ILIKE :search)',
        { search: '%test search%' }
      );
    });

    it('should apply status filter when provided', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      await service.findAll({ status: HouseholdStatus.INACTIVE });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'household.status = :status',
        { status: HouseholdStatus.INACTIVE }
      );
    });

    it('should handle pagination correctly', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 25]),
      };

      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAll({ page: 3, limit: 5 });

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10); // (3-1) * 5
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);
      expect(result.page).toBe(3);
      expect(result.totalPages).toBe(5); // Math.ceil(25/5)
    });
  });

  describe('findOne', () => {
    it('should return household when found', async () => {
      const mockHousehold = {
        id: 'household-123',
        name: 'Test Household',
        status: HouseholdStatus.ACTIVE,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockHousehold),
      };

      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.findOne('household-123');

      expect(result).toEqual(mockHousehold);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('household.id = :id', { id: 'household-123' });
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('household.users', 'users');
    });

    it('should throw NotFoundException when household not found', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update household successfully', async () => {
      const updateDto: UpdateHouseholdDto = {
        name: 'Updated Household',
        description: 'Updated description',
      };

      const existingHousehold = {
        id: 'household-123',
        name: 'Old Name',
        description: 'Old description',
      };

      const updatedHousehold = {
        ...existingHousehold,
        ...updateDto,
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(existingHousehold as any);
      jest.spyOn(repository, 'findOne').mockResolvedValue(null); // No name conflict
      jest.spyOn(repository, 'save').mockResolvedValue(updatedHousehold as any);

      const result = await service.update('household-123', updateDto);

      expect(result).toEqual(updatedHousehold);
      expect(repository.save).toHaveBeenCalledWith(updatedHousehold);
    });

    it('should throw ConflictException when updating to existing household name', async () => {
      const updateDto: UpdateHouseholdDto = {
        name: 'Existing Name',
      };

      const existingHousehold = {
        id: 'household-123',
        name: 'Current Name',
      };

      const conflictingHousehold = {
        id: 'other-household',
        name: 'Existing Name',
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(existingHousehold as any);
      jest.spyOn(repository, 'findOne').mockResolvedValue(conflictingHousehold as any);

      await expect(service.update('household-123', updateDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should remove household when it has no members', async () => {
      const household = {
        id: 'household-123',
        name: 'Empty Household',
        member_count: 0,
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(household as any);
      jest.spyOn(repository, 'softDelete').mockResolvedValue({} as any);

      await service.remove('household-123');

      expect(repository.softDelete).toHaveBeenCalledWith('household-123');
    });

    it('should throw ConflictException when household has active members', async () => {
      const household = {
        id: 'household-123',
        name: 'Active Household',
        member_count: 3,
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(household as any);

      await expect(service.remove('household-123')).rejects.toThrow(ConflictException);
      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('updateMemberCount', () => {
    it('should increment member count', async () => {
      jest.spyOn(repository, 'increment').mockResolvedValue({} as any);

      await service.updateMemberCount('household-123', 2);

      expect(repository.increment).toHaveBeenCalledWith(
        { id: 'household-123' },
        'member_count',
        2
      );
    });

    it('should decrement member count with negative increment', async () => {
      jest.spyOn(repository, 'increment').mockResolvedValue({} as any);

      await service.updateMemberCount('household-123', -1);

      expect(repository.increment).toHaveBeenCalledWith(
        { id: 'household-123' },
        'member_count',
        -1
      );
    });
  });

  describe('updateFinancials', () => {
    it('should update income and expenses', async () => {
      jest.spyOn(repository, 'update').mockResolvedValue({} as any);

      await service.updateFinancials('household-123', 50000, 30000);

      expect(repository.update).toHaveBeenCalledWith('household-123', {
        total_income: 50000,
        total_expenses: 30000,
      });
    });

    it('should update only income when expenses not provided', async () => {
      jest.spyOn(repository, 'update').mockResolvedValue({} as any);

      await service.updateFinancials('household-123', 60000);

      expect(repository.update).toHaveBeenCalledWith('household-123', {
        total_income: 60000,
      });
    });

    it('should not update anything when no values provided', async () => {
      jest.spyOn(repository, 'update').mockResolvedValue({} as any);

      await service.updateFinancials('household-123');

      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('getHouseholdStats', () => {
    it('should return household statistics', async () => {
      const household = {
        id: 'household-123',
        member_count: 5,
        total_income: 100000,
        total_expenses: 75000,
        status: HouseholdStatus.ACTIVE,
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(household as any);

      const result = await service.getHouseholdStats('household-123');

      expect(result).toEqual({
        memberCount: 5,
        totalIncome: 100000,
        totalExpenses: 75000,
        netIncome: 25000,
        status: HouseholdStatus.ACTIVE,
      });
    });
  });

  describe('status management', () => {
    it('should activate household', async () => {
      jest.spyOn(service, 'update').mockResolvedValue({} as any);

      await service.activate('household-123');

      expect(service.update).toHaveBeenCalledWith('household-123', { status: HouseholdStatus.ACTIVE });
    });

    it('should deactivate household', async () => {
      jest.spyOn(service, 'update').mockResolvedValue({} as any);

      await service.deactivate('household-123');

      expect(service.update).toHaveBeenCalledWith('household-123', { status: HouseholdStatus.INACTIVE });
    });

    it('should suspend household', async () => {
      jest.spyOn(service, 'update').mockResolvedValue({} as any);

      await service.suspend('household-123');

      expect(service.update).toHaveBeenCalledWith('household-123', { status: HouseholdStatus.SUSPENDED });
    });
  });
});
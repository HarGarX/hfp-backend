import { Test, TestingModule } from '@nestjs/testing';
import { HouseholdsService } from './households.service';
import { HouseholdRepository } from './repositories/household.repository';
import { TenantContextService } from '../../libs/tenant';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { HouseholdStatus } from './entities/household.entity';

describe('HouseholdsService', () => {
  let service: HouseholdsService;
  let mockRepository: jest.Mocked<HouseholdRepository>;
  let mockTenantContext: jest.Mocked<TenantContextService>;

  beforeEach(async () => {
    const mockRepositoryValue = {
      findByName: jest.fn(),
      create: jest.fn(),
      findAllPaginated: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      updateMemberCount: jest.fn(),
      getStatistics: jest.fn(),
      activate: jest.fn(),
      deactivate: jest.fn(),
      suspend: jest.fn(),
      countActiveMembers: jest.fn(),
    };

    const mockTenantContextValue = {
      getTenantId: jest.fn().mockReturnValue('test-tenant'),
      getUserId: jest.fn().mockReturnValue('test-user'),
      getTenantContext: jest.fn().mockReturnValue({ tenantId: 'test-tenant', userId: 'test-user' }),
      requireTenantContext: jest.fn().mockReturnValue({ tenantId: 'test-tenant', userId: 'test-user' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HouseholdsService,
        {
          provide: HouseholdRepository,
          useValue: mockRepositoryValue,
        },
        {
          provide: TenantContextService,
          useValue: mockTenantContextValue,
        },
      ],
    }).compile();

    service = module.get<HouseholdsService>(HouseholdsService);
    mockRepository = module.get(HouseholdRepository);
    mockTenantContext = module.get(TenantContextService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      name: 'Test Household',
      description: 'Test description',
    };

    it('should create a household successfully', async () => {
      const expectedHousehold = {
        id: 'household-123',
        status: HouseholdStatus.ACTIVE,
        default_currency: 'USD',
        member_count: 0,
        total_income: 0,
        total_expenses: 0,
        ...createDto,
      };

      mockRepository.findByName.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(expectedHousehold as any);

      const result = await service.create(createDto);

      expect(mockRepository.findByName).toHaveBeenCalledWith('Test Household');
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createDto,
        status: HouseholdStatus.ACTIVE,
        default_currency: 'USD',
        member_count: 0,
        total_income: 0,
        total_expenses: 0,
      });
      expect(result).toEqual(expectedHousehold);
    });

    it('should throw ConflictException when household name exists', async () => {
      const existingHousehold = { id: 'existing-123', name: 'Test Household' };
      mockRepository.findByName.mockResolvedValue(existingHousehold as any);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      expect(mockRepository.findByName).toHaveBeenCalledWith('Test Household');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should use provided status and currency', async () => {
      const createDtoWithCustom = {
        ...createDto,
        status: HouseholdStatus.INACTIVE,
        default_currency: 'EUR',
      };

      mockRepository.findByName.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue({} as any);

      await service.create(createDtoWithCustom);

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createDtoWithCustom,
        member_count: 0,
        total_income: 0,
        total_expenses: 0,
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated households with default options', async () => {
      const expectedResult = {
        households: [
          { 
            id: '1', 
            name: 'Household 1',
            status: HouseholdStatus.ACTIVE,
            default_currency: 'USD',
            member_count: 1,
            total_income: 0,
            total_expenses: 0,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
            users: [],
          },
          { 
            id: '2', 
            name: 'Household 2',
            status: HouseholdStatus.ACTIVE,
            default_currency: 'USD',
            member_count: 1,
            total_income: 0,
            total_expenses: 0,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
            users: [],
          },
        ] as any[],
        total: 2,
        page: 1,
        totalPages: 1,
      };

      mockRepository.findAllPaginated.mockResolvedValue(expectedResult);

      const result = await service.findAll();

      expect(mockRepository.findAllPaginated).toHaveBeenCalledWith({});
      expect(result).toEqual(expectedResult);
    });

    it('should pass options to repository', async () => {
      const options = { page: 2, limit: 10, search: 'test' };
      mockRepository.findAllPaginated.mockResolvedValue({} as any);

      await service.findAll(options);

      expect(mockRepository.findAllPaginated).toHaveBeenCalledWith(options);
    });
  });

  describe('findOne', () => {
    it('should return household when found', async () => {
      const household = { id: 'household-123', name: 'Test Household' };
      mockRepository.findById.mockResolvedValue(household as any);

      const result = await service.findOne('household-123');

      expect(mockRepository.findById).toHaveBeenCalledWith('household-123');
      expect(result).toEqual(household);
    });

    it('should throw NotFoundException when household not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
      expect(mockRepository.findById).toHaveBeenCalledWith('nonexistent-id');
    });
  });

  describe('update', () => {
    const updateDto = { name: 'Updated Household' };

    it('should update household successfully', async () => {
      const updatedHousehold = { id: 'household-123', ...updateDto };

      mockRepository.findByName.mockResolvedValue(null); // No name conflict
      mockRepository.update.mockResolvedValue(updatedHousehold as any);

      const result = await service.update('household-123', updateDto);

      expect(mockRepository.findByName).toHaveBeenCalledWith('Updated Household');
      expect(mockRepository.update).toHaveBeenCalledWith('household-123', updateDto);
      expect(result).toEqual(updatedHousehold);
    });

    it('should throw ConflictException when name conflicts with another household', async () => {
      const conflictingHousehold = { id: 'different-id', name: 'Updated Household' };
      mockRepository.findByName.mockResolvedValue(conflictingHousehold as any);

      await expect(service.update('household-123', updateDto)).rejects.toThrow(ConflictException);
      expect(mockRepository.findByName).toHaveBeenCalledWith('Updated Household');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should allow updating to same name for same household', async () => {
      const sameHousehold = { id: 'household-123', name: 'Updated Household' };
      mockRepository.findByName.mockResolvedValue(sameHousehold as any);
      mockRepository.update.mockResolvedValue(sameHousehold as any);

      const result = await service.update('household-123', updateDto);

      expect(mockRepository.update).toHaveBeenCalledWith('household-123', updateDto);
      expect(result).toEqual(sameHousehold);
    });

    it('should throw NotFoundException when household not found', async () => {
      mockRepository.findByName.mockResolvedValue(null);
      mockRepository.update.mockResolvedValue(null);

      await expect(service.update('household-123', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should skip name check when not updating name', async () => {
      const updateDtoWithoutName = { description: 'Updated description' };
      const updatedHousehold = { id: 'household-123', description: 'Updated description' };

      mockRepository.update.mockResolvedValue(updatedHousehold as any);

      const result = await service.update('household-123', updateDtoWithoutName);

      expect(mockRepository.findByName).not.toHaveBeenCalled();
      expect(mockRepository.update).toHaveBeenCalledWith('household-123', updateDtoWithoutName);
      expect(result).toEqual(updatedHousehold);
    });
  });

  describe('remove', () => {
    it('should remove household successfully when no members', async () => {
      const household = { id: 'household-123', member_count: 0 };
      mockRepository.findById.mockResolvedValue(household as any);
      mockRepository.softDelete.mockResolvedValue(true);

      await service.remove('household-123');

      expect(mockRepository.findById).toHaveBeenCalledWith('household-123');
      expect(mockRepository.softDelete).toHaveBeenCalledWith('household-123');
    });

    it('should throw ConflictException when household has members', async () => {
      const household = { id: 'household-123', member_count: 2 };
      mockRepository.findById.mockResolvedValue(household as any);

      await expect(service.remove('household-123')).rejects.toThrow(ConflictException);
      expect(mockRepository.softDelete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when household not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.remove('household-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when soft delete fails', async () => {
      const household = { id: 'household-123', member_count: 0 };
      mockRepository.findById.mockResolvedValue(household as any);
      mockRepository.softDelete.mockResolvedValue(false);

      await expect(service.remove('household-123')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateMemberCount', () => {
    it('should update member count', async () => {
      mockRepository.updateMemberCount.mockResolvedValue();

      await service.updateMemberCount('household-123');

      expect(mockRepository.updateMemberCount).toHaveBeenCalledWith('household-123');
    });
  });

  describe('updateFinancials', () => {
    it('should update both income and expenses', async () => {
      mockRepository.update.mockResolvedValue({} as any);

      await service.updateFinancials('household-123', 50000, 30000);

      expect(mockRepository.update).toHaveBeenCalledWith('household-123', {
        total_income: 50000,
        total_expenses: 30000,
      });
    });

    it('should update only income when expenses not provided', async () => {
      mockRepository.update.mockResolvedValue({} as any);

      await service.updateFinancials('household-123', 60000);

      expect(mockRepository.update).toHaveBeenCalledWith('household-123', {
        total_income: 60000,
      });
    });

    it('should update only expenses when income not provided', async () => {
      mockRepository.update.mockResolvedValue({} as any);

      await service.updateFinancials('household-123', undefined, 35000);

      expect(mockRepository.update).toHaveBeenCalledWith('household-123', {
        total_expenses: 35000,
      });
    });

    it('should not call update when no values provided', async () => {
      await service.updateFinancials('household-123');

      expect(mockRepository.update).not.toHaveBeenCalled();
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

      mockRepository.findById.mockResolvedValue(household as any);

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
      const household = { id: 'household-123', status: HouseholdStatus.ACTIVE };
      mockRepository.findByName.mockResolvedValue(null);
      mockRepository.update.mockResolvedValue(household as any);

      const result = await service.activate('household-123');

      expect(mockRepository.update).toHaveBeenCalledWith('household-123', { status: HouseholdStatus.ACTIVE });
      expect(result).toEqual(household);
    });

    it('should deactivate household', async () => {
      const household = { id: 'household-123', status: HouseholdStatus.INACTIVE };
      mockRepository.findByName.mockResolvedValue(null);
      mockRepository.update.mockResolvedValue(household as any);

      const result = await service.deactivate('household-123');

      expect(mockRepository.update).toHaveBeenCalledWith('household-123', { status: HouseholdStatus.INACTIVE });
      expect(result).toEqual(household);
    });

    it('should suspend household', async () => {
      const household = { id: 'household-123', status: HouseholdStatus.SUSPENDED };
      mockRepository.findByName.mockResolvedValue(null);
      mockRepository.update.mockResolvedValue(household as any);

      const result = await service.suspend('household-123');

      expect(mockRepository.update).toHaveBeenCalledWith('household-123', { status: HouseholdStatus.SUSPENDED });
      expect(result).toEqual(household);
    });
  });
});
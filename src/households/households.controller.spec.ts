import { Test, TestingModule } from '@nestjs/testing';
import { HouseholdsController } from './households.controller';
import { HouseholdsService } from './households.service';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { UpdateHouseholdDto } from './dto/update-household.dto';
import { HouseholdStatus, Household } from './entities/household.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PaginatedHouseholds } from './repositories/household.repository';

describe('HouseholdsController', () => {
  let controller: HouseholdsController;
  let service: jest.Mocked<HouseholdsService>;

  const mockHousehold: Partial<Household> = {
    id: 'household-123',
    name: 'Test Household',
    description: 'Test description',
    status: HouseholdStatus.ACTIVE,
    default_currency: 'USD',
    member_count: 0,
    total_income: 0,
    total_expenses: 0,
    created_at: new Date(),
    updated_at: new Date(),
    users: [],
  };

  const mockRequest = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      household_id: 'household-123',
      roles: ['household_admin'],
    },
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      updateMemberCount: jest.fn(),
      updateFinancials: jest.fn(),
      getHouseholdStats: jest.fn(),
      activate: jest.fn(),
      deactivate: jest.fn(),
      suspend: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HouseholdsController],
      providers: [
        {
          provide: HouseholdsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<HouseholdsController>(HouseholdsController);
    service = module.get(HouseholdsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateHouseholdDto = {
      name: 'New Household',
      description: 'New household description',
    };

    it('should create a household successfully', async () => {
      service.create.mockResolvedValue(mockHousehold as any);

      const result = await controller.create(createDto, mockRequest as any);

      expect(service.create).toHaveBeenCalledWith(createDto, 'user-123');
      expect(result).toEqual(mockHousehold);
    });

    it('should handle ConflictException', async () => {
      service.create.mockRejectedValue(new ConflictException('Household with this name already exists'));

      await expect(controller.create(createDto, mockRequest as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    const paginatedResult: PaginatedHouseholds = {
      households: [mockHousehold as Household],
      total: 1,
      page: 1,
      totalPages: 1,
    };

    it('should return paginated households with query object', async () => {
      const queryObject = {
        search: 'test',
        status: HouseholdStatus.ACTIVE,
        page: '1',
        limit: '10',
      };

      service.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(queryObject);

      expect(service.findAll).toHaveBeenCalledWith({
        search: 'test',
        status: HouseholdStatus.ACTIVE,
        page: 1,
        limit: 10,
      });
      expect(result).toEqual(paginatedResult);
    });

    it('should return paginated households with empty query object', async () => {
      service.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll({});

      expect(service.findAll).toHaveBeenCalledWith({
        search: undefined,
        status: undefined,
        page: 1,
        limit: 10,
      });
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('findOne', () => {
    it('should return a household by id', async () => {
      service.findOne.mockResolvedValue(mockHousehold as any);

      const result = await controller.findOne('household-123', mockRequest as any);

      expect(service.findOne).toHaveBeenCalledWith('household-123', 'user-123');
      expect(result).toEqual(mockHousehold);
    });

    it('should handle NotFoundException', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Household not found'));

      await expect(controller.findOne('nonexistent-id', mockRequest as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateHouseholdDto = {
      name: 'Updated Household',
      description: 'Updated description',
    };

    it('should update a household successfully', async () => {
      const updatedHousehold = { ...mockHousehold, ...updateDto };
      service.update.mockResolvedValue(updatedHousehold as any);

      const result = await controller.update('household-123', updateDto, mockRequest as any);

      expect(service.update).toHaveBeenCalledWith('household-123', updateDto, 'user-123');
      expect(result).toEqual(updatedHousehold);
    });

    it('should handle ConflictException on name conflict', async () => {
      service.update.mockRejectedValue(new ConflictException('Household with this name already exists'));

      await expect(controller.update('household-123', updateDto, mockRequest as any)).rejects.toThrow(ConflictException);
    });

    it('should handle NotFoundException', async () => {
      service.update.mockRejectedValue(new NotFoundException('Household not found'));

      await expect(controller.update('nonexistent-id', updateDto, mockRequest as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a household successfully', async () => {
      service.remove.mockResolvedValue();

      await controller.remove('household-123', mockRequest as any);

      expect(service.remove).toHaveBeenCalledWith('household-123', 'user-123');
    });

    it('should handle NotFoundException', async () => {
      service.remove.mockRejectedValue(new NotFoundException('Household not found'));

      await expect(controller.remove('nonexistent-id', mockRequest as any)).rejects.toThrow(NotFoundException);
    });

    it('should handle ConflictException when household has members', async () => {
      service.remove.mockRejectedValue(new ConflictException('Cannot delete household with active members'));

      await expect(controller.remove('household-123', mockRequest as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('getHouseholdStats', () => {
    const statsResult = {
      memberCount: 5,
      totalIncome: 45000,
      totalExpenses: 2500,
      netIncome: 42500,
      status: HouseholdStatus.ACTIVE,
    };

    it('should return household statistics', async () => {
      service.getHouseholdStats.mockResolvedValue(statsResult);

      const result = await controller.getHouseholdStats('household-123', mockRequest as any);

      expect(service.getHouseholdStats).toHaveBeenCalledWith('household-123');
      expect(result).toEqual(statsResult);
    });

    it('should handle NotFoundException', async () => {
      service.getHouseholdStats.mockRejectedValue(new NotFoundException('Household not found'));

      await expect(controller.getHouseholdStats('nonexistent-id', mockRequest as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('activate', () => {
    it('should activate household successfully', async () => {
      const activeHousehold = { ...mockHousehold, status: HouseholdStatus.ACTIVE };
      service.activate.mockResolvedValue(activeHousehold as any);

      const result = await controller.activate('household-123');

      expect(service.activate).toHaveBeenCalledWith('household-123');
      expect(result).toEqual(activeHousehold);
    });
  });

  describe('deactivate', () => {
    it('should deactivate household successfully', async () => {
      const inactiveHousehold = { ...mockHousehold, status: HouseholdStatus.INACTIVE };
      service.deactivate.mockResolvedValue(inactiveHousehold as any);

      const result = await controller.deactivate('household-123');

      expect(service.deactivate).toHaveBeenCalledWith('household-123');
      expect(result).toEqual(inactiveHousehold);
    });
  });

  describe('suspend', () => {
    it('should suspend household successfully', async () => {
      const suspendedHousehold = { ...mockHousehold, status: HouseholdStatus.SUSPENDED };
      service.suspend.mockResolvedValue(suspendedHousehold as any);

      const result = await controller.suspend('household-123');

      expect(service.suspend).toHaveBeenCalledWith('household-123');
      expect(result).toEqual(suspendedHousehold);
    });
  });
});
import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { HouseholdRepository, HouseholdQueryOptions, PaginatedHouseholds } from './repositories/household.repository';
import { Household, HouseholdStatus } from './entities/household.entity';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { UpdateHouseholdDto } from './dto/update-household.dto';
import { TenantContextService } from '../../libs/tenant';

@Injectable()
export class HouseholdsService {
  constructor(
    private readonly householdRepository: HouseholdRepository,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(createHouseholdDto: CreateHouseholdDto, createdBy?: string): Promise<Household> {
    // Check if household with same name already exists
    const existingHousehold = await this.householdRepository.findByName(createHouseholdDto.name);

    if (existingHousehold) {
      throw new ConflictException('Household with this name already exists');
    }

    const householdData = {
      ...createHouseholdDto,
      status: createHouseholdDto.status || HouseholdStatus.ACTIVE,
      default_currency: createHouseholdDto.default_currency || 'USD',
      member_count: 0,
      total_income: 0,
      total_expenses: 0,
    };

    return this.householdRepository.create(householdData);
  }

  async findAll(options: HouseholdQueryOptions = {}): Promise<PaginatedHouseholds> {
    return this.householdRepository.findAllPaginated(options);
  }

  async findOne(id: string, userId?: string): Promise<Household> {
    const household = await this.householdRepository.findById(id);

    if (!household) {
      throw new NotFoundException('Household not found');
    }

    return household;
  }

  async update(id: string, updateHouseholdDto: UpdateHouseholdDto, userId?: string): Promise<Household> {
    // Check if trying to update name and it conflicts with existing
    if (updateHouseholdDto.name) {
      const existingHousehold = await this.householdRepository.findByName(updateHouseholdDto.name);
      if (existingHousehold && existingHousehold.id !== id) {
        throw new ConflictException('Household with this name already exists');
      }
    }

    const updatedHousehold = await this.householdRepository.update(id, updateHouseholdDto);
    if (!updatedHousehold) {
      throw new NotFoundException('Household not found or access denied');
    }

    return updatedHousehold;
  }

  async remove(id: string, userId?: string): Promise<void> {
    const household = await this.findOne(id, userId);

    // Check if household has members
    if (household.member_count > 0) {
      throw new ConflictException('Cannot delete household with active members. Remove all members first.');
    }

    const deleted = await this.householdRepository.softDelete(id);
    if (!deleted) {
      throw new ForbiddenException('Access denied or household not found');
    }
  }

  async updateMemberCount(householdId: string): Promise<void> {
    await this.householdRepository.updateMemberCount(householdId);
  }

  async updateFinancials(
    householdId: string, 
    totalIncome?: number, 
    totalExpenses?: number
  ): Promise<void> {
    const updateData: any = {};
    
    if (totalIncome !== undefined) {
      updateData.total_income = totalIncome;
    }
    
    if (totalExpenses !== undefined) {
      updateData.total_expenses = totalExpenses;
    }

    if (Object.keys(updateData).length > 0) {
      const updated = await this.householdRepository.update(householdId, updateData);
      if (!updated) {
        throw new NotFoundException('Household not found or access denied');
      }
    }
  }

  async getHouseholdStats(householdId: string): Promise<{
    memberCount: number;
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
    status: HouseholdStatus;
  }> {
    const household = await this.findOne(householdId);

    return {
      memberCount: household.member_count,
      totalIncome: Number(household.total_income),
      totalExpenses: Number(household.total_expenses),
      netIncome: Number(household.total_income) - Number(household.total_expenses),
      status: household.status,
    };
  }

  async activate(householdId: string): Promise<Household> {
    return this.update(householdId, { status: HouseholdStatus.ACTIVE });
  }

  async deactivate(householdId: string): Promise<Household> {
    return this.update(householdId, { status: HouseholdStatus.INACTIVE });
  }

  async suspend(householdId: string): Promise<Household> {
    return this.update(householdId, { status: HouseholdStatus.SUSPENDED });
  }

  async getStatistics() {
    return this.householdRepository.getStatistics();
  }
}
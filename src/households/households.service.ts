import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Household, HouseholdStatus } from './entities/household.entity';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { UpdateHouseholdDto } from './dto/update-household.dto';

export interface HouseholdQueryOptions {
  search?: string;
  status?: HouseholdStatus;
  page?: number;
  limit?: number;
}

export interface PaginatedHouseholds {
  households: Household[];
  total: number;
  page: number;
  totalPages: number;
}

@Injectable()
export class HouseholdsService {
  constructor(
    @InjectRepository(Household)
    private householdsRepository: Repository<Household>,
  ) {}

  async create(createHouseholdDto: CreateHouseholdDto, createdBy?: string): Promise<Household> {
    // Check if household with same name already exists
    const existingHousehold = await this.householdsRepository.findOne({
      where: { name: createHouseholdDto.name }
    });

    if (existingHousehold) {
      throw new ConflictException('Household with this name already exists');
    }

    const household = this.householdsRepository.create({
      ...createHouseholdDto,
      status: createHouseholdDto.status || HouseholdStatus.ACTIVE,
      default_currency: createHouseholdDto.default_currency || 'USD',
      member_count: 0,
      total_income: 0,
      total_expenses: 0,
    });

    return this.householdsRepository.save(household);
  }

  async findAll(options: HouseholdQueryOptions = {}): Promise<PaginatedHouseholds> {
    const { search, status, page = 1, limit = 10 } = options;
    
    const queryBuilder = this.householdsRepository.createQueryBuilder('household');
    
    // Add search functionality
    if (search) {
      queryBuilder.where(
        '(household.name ILIKE :search OR household.description ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Filter by status
    if (status) {
      queryBuilder.andWhere('household.status = :status', { status });
    }

    // Add pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Order by created_at desc
    queryBuilder.orderBy('household.created_at', 'DESC');

    // Load relations
    queryBuilder.leftJoinAndSelect('household.users', 'users');

    const [households, total] = await queryBuilder.getManyAndCount();

    return {
      households,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, userId?: string): Promise<Household> {
    const queryBuilder = this.householdsRepository.createQueryBuilder('household')
      .where('household.id = :id', { id })
      .leftJoinAndSelect('household.users', 'users');

    const household = await queryBuilder.getOne();

    if (!household) {
      throw new NotFoundException(`Household with ID ${id} not found`);
    }

    return household;
  }

  async update(id: string, updateHouseholdDto: UpdateHouseholdDto, userId?: string): Promise<Household> {
    const household = await this.findOne(id, userId);

    // Check if trying to update name and it conflicts with existing
    if (updateHouseholdDto.name && updateHouseholdDto.name !== household.name) {
      const existingHousehold = await this.householdsRepository.findOne({
        where: { name: updateHouseholdDto.name }
      });

      if (existingHousehold) {
        throw new ConflictException('Household with this name already exists');
      }
    }

    // Update household
    Object.assign(household, updateHouseholdDto);
    
    return this.householdsRepository.save(household);
  }

  async remove(id: string, userId?: string): Promise<void> {
    const household = await this.findOne(id, userId);

    // Check if household has members
    if (household.member_count > 0) {
      throw new ConflictException('Cannot delete household with active members. Remove all members first.');
    }

    // Soft delete
    await this.householdsRepository.softDelete(id);
  }

  async updateMemberCount(householdId: string, increment: number = 1): Promise<void> {
    await this.householdsRepository.increment(
      { id: householdId }, 
      'member_count', 
      increment
    );
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
      await this.householdsRepository.update(householdId, updateData);
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
}
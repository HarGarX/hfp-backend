import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository, DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { testDatabaseConfig } from './test-database.config';
import { User, UserRole } from '../src/users/entities/user.entity';
import { Household, HouseholdStatus } from '../src/households/entities/household.entity';

export interface TestUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  household_id: string;
  password_hash?: string;
  keycloak_id?: string;
}

export interface TestHousehold {
  id: string;
  name: string;
  description?: string;
  status: HouseholdStatus;
  default_currency: string;
  member_count: number;
  total_income: number;
  total_expenses: number;
}

export class TestHelper {
  static async createTestingModule(imports: any[] = [], providers: any[] = []): Promise<TestingModule> {
    return Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(testDatabaseConfig),
        ...imports,
      ],
      providers,
    }).compile();
  }

  static async createApp(module: TestingModule): Promise<INestApplication> {
    const app = module.createNestApplication();
    // Enable transform/validation to match runtime behavior in src/main.ts
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    await app.init();
    return app;
  }

  static generateJwtToken(user: TestUser, jwtService: JwtService): string {
    const payload = {
      sub: user.id,
      email: user.email,
      household_id: user.household_id,
      role: user.role,
    };
    return jwtService.sign(payload);
  }

  static async createTestHousehold(
    householdRepo: Repository<Household>, 
    overrides: Partial<TestHousehold> = {}
  ): Promise<TestHousehold> {
    const household = householdRepo.create({
      name: 'Test Household',
      description: 'Test household for unit tests',
      status: HouseholdStatus.ACTIVE,
      default_currency: 'USD',
      member_count: 0,
      total_income: 0,
      total_expenses: 0,
      ...overrides,
    });

    const saved = await householdRepo.save(household);
    return saved as TestHousehold;
  }

  static async createTestUser(
    userRepo: Repository<User>, 
    household: TestHousehold,
    overrides: Partial<TestUser> = {}
  ): Promise<TestUser> {
    const user = userRepo.create({
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      role: UserRole.MEMBER,
      household_id: household.id,
      password_hash: '$2b$12$example.hash.for.testing',
      ...overrides,
    });

    const saved = await userRepo.save(user);
    return saved as TestUser;
  }

  static async createAdminUser(
    userRepo: Repository<User>, 
    household: TestHousehold
  ): Promise<TestUser> {
    return this.createTestUser(userRepo, household, {
      email: `admin.${Date.now()}@example.com`,
      role: UserRole.ADMIN,
      first_name: 'Admin',
      last_name: 'User',
    });
  }

  static async createHouseholdAdminUser(
    userRepo: Repository<User>, 
    household: TestHousehold
  ): Promise<TestUser> {
    return this.createTestUser(userRepo, household, {
      email: `household.admin.${Date.now()}@example.com`,
      role: UserRole.HOUSEHOLD_ADMIN,
      first_name: 'Household',
      last_name: 'Admin',
    });
  }

  static async cleanupDatabase(module: TestingModule): Promise<void> {
    const dataSource = module.get<DataSource>(DataSource);
    
    try {
      // Get all table names to truncate in dependency order
      const entities = dataSource.entityMetadatas;
      const tableNames = entities.map(entity => `"${entity.tableName}"`);
      
      // Drop and recreate database schema (safer approach)
      await dataSource.dropDatabase();
      await dataSource.synchronize();
    } catch (error) {
      console.error('Database cleanup failed:', error);
      // Fallback: try to delete records in dependency order
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      
      try {
        // Disable foreign key checks temporarily
        await queryRunner.query('SET session_replication_role = replica;');
        
        // Delete from tables that have foreign key dependencies first
        await queryRunner.query('DELETE FROM transactions;');
        await queryRunner.query('DELETE FROM categories;');
        await queryRunner.query('DELETE FROM accounts;');
        await queryRunner.query('DELETE FROM users;');
        await queryRunner.query('DELETE FROM households;');
        
        // Re-enable foreign key checks
        await queryRunner.query('SET session_replication_role = DEFAULT;');
      } finally {
        await queryRunner.release();
      }
    }
  }
}
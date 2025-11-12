import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { User } from '../src/users/entities/user.entity';
import { Household } from '../src/households/entities/household.entity';
import { Account } from '../src/accounts/entities/account.entity';

export const testDatabaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5433', 10),
  username: process.env.TEST_DB_USERNAME || 'postgres',
  password: process.env.TEST_DB_PASSWORD || 'postgres',
  database: process.env.TEST_DB_NAME || 'hfp_test',
  entities: [User, Household, Account],
  synchronize: true, // Use synchronize in tests for simplicity
  dropSchema: true, // Clean database for each test run
  logging: false,
};

export const testDataSource = new DataSource({
  ...testDatabaseConfig,
  type: 'postgres',
} as any);

export const getTestDbConnection = () => testDataSource;
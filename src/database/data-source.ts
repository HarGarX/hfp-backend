import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config(); // Load environment variables from .env file

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'hfp_dev',
  entities: ['src/**/*.entity.ts', 'libs/**/*.entity.ts'],
  migrations: ['libs/db/migrations/*.ts'],
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
});
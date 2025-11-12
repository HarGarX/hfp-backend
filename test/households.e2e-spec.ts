import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { User, UserRole } from '../src/users/entities/user.entity';
import { Household, HouseholdStatus } from '../src/households/entities/household.entity';
import { testDatabaseConfig } from './test-database.config';
import { TestHelper, TestUser, TestHousehold } from './test-helper';

describe('Households Controller (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let userRepository: Repository<User>;
  let householdRepository: Repository<Household>;
  let jwtService: JwtService;
  let testHousehold: TestHousehold;
  let adminUser: TestUser;
  let householdAdminUser: TestUser;
  let memberUser: TestUser;
  let adminToken: string;
  let householdAdminToken: string;
  let memberToken: string;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(testDatabaseConfig),
        AppModule,
      ],
    }).compile();

    app = await TestHelper.createApp(module);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    householdRepository = module.get<Repository<Household>>(getRepositoryToken(Household));
    jwtService = module.get<JwtService>(JwtService);

    // Create test household and users with different roles
    testHousehold = await TestHelper.createTestHousehold(householdRepository);
    adminUser = await TestHelper.createAdminUser(userRepository, testHousehold);
    householdAdminUser = await TestHelper.createHouseholdAdminUser(userRepository, testHousehold);
    memberUser = await TestHelper.createTestUser(userRepository, testHousehold);

    // Update household member count to reflect the users we created
    await householdRepository.update(testHousehold.id, { member_count: 3 });

    // Generate JWT tokens for each user
    adminToken = TestHelper.generateJwtToken(adminUser, jwtService);
    householdAdminToken = TestHelper.generateJwtToken(householdAdminUser, jwtService);
    memberToken = TestHelper.generateJwtToken(memberUser, jwtService);
  });

  afterEach(async () => {
    await TestHelper.cleanupDatabase(module);
    await app.close();
  });

  describe('/households (POST)', () => {
    it('should create household when user is admin', () => {
      return request(app.getHttpServer())
        .post('/households')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Test Household',
          description: 'A new household for testing',
          default_currency: 'EUR',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('New Test Household');
          expect(res.body.description).toBe('A new household for testing');
          expect(res.body.default_currency).toBe('EUR');
          expect(res.body.status).toBe(HouseholdStatus.ACTIVE);
        });
    });

    it('should create household when user is household admin', () => {
      return request(app.getHttpServer())
        .post('/households')
        .set('Authorization', `Bearer ${householdAdminToken}`)
        .send({
          name: 'Household Admin Created',
          description: 'Created by household admin',
        })
        .expect(201);
    });

    it('should deny access for regular members', () => {
      return request(app.getHttpServer())
        .post('/households')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          name: 'Member Attempt',
          description: 'This should fail',
        })
        .expect(403);
    });

    it('should deny access without authentication', () => {
      return request(app.getHttpServer())
        .post('/households')
        .send({
          name: 'Unauthenticated Attempt',
        })
        .expect(401);
    });

    it('should return 409 for duplicate household name', async () => {
      // First create a household
      await request(app.getHttpServer())
        .post('/households')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Unique Household',
          description: 'First household',
        })
        .expect(201);

      // Try to create another with same name
      return request(app.getHttpServer())
        .post('/households')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Unique Household',
          description: 'Duplicate name',
        })
        .expect(409);
    });

    it('should validate required fields', () => {
      return request(app.getHttpServer())
        .post('/households')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          // missing name
          description: 'Missing name field',
        })
        .expect(400);
    });
  });

  describe('/households (GET)', () => {
    beforeEach(async () => {
      // Create additional households for listing tests
      await TestHelper.createTestHousehold(householdRepository, {
        name: 'Active Household 1',
        status: HouseholdStatus.ACTIVE,
      });
      await TestHelper.createTestHousehold(householdRepository, {
        name: 'Inactive Household',
        status: HouseholdStatus.INACTIVE,
      });
      await TestHelper.createTestHousehold(householdRepository, {
        name: 'Suspended Household',
        status: HouseholdStatus.SUSPENDED,
      });
    });

    it('should list all households for admin users', () => {
      return request(app.getHttpServer())
        .get('/households')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('households');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('page');
          expect(res.body).toHaveProperty('totalPages');
          expect(Array.isArray(res.body.households)).toBe(true);
          expect(res.body.households.length).toBeGreaterThan(0);
        });
    });

    it('should deny access for non-admin users', () => {
      return request(app.getHttpServer())
        .get('/households')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('should support pagination', () => {
      return request(app.getHttpServer())
        .get('/households')
        .query({ page: 2, limit: 2 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.page).toBe(2);
          expect(res.body.households.length).toBeLessThanOrEqual(2);
        });
    });

    it('should support search functionality', () => {
      return request(app.getHttpServer())
        .get('/households')
        .query({ search: 'Active' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          // The search should return households that contain "Active" in name or description
          // This includes both "Active Household 1" and "Inactive Household" (contains "active")
          expect(res.body.households.every((h: any) => 
            h.name.toLowerCase().includes('active') || (h.description && h.description.toLowerCase().includes('active'))
          )).toBe(true);
        });
    });

    it('should support status filtering', () => {
      return request(app.getHttpServer())
        .get('/households')
        .query({ status: HouseholdStatus.INACTIVE })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.households.every((h: any) => h.status === HouseholdStatus.INACTIVE)).toBe(true);
        });
    });
  });

  describe('/households/:id (GET)', () => {
    it('should get household details for any authenticated user', () => {
      return request(app.getHttpServer())
        .get(`/households/${testHousehold.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(testHousehold.id);
          expect(res.body.name).toBe(testHousehold.name);
        });
    });

    it('should return 404 for non-existent household', () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      return request(app.getHttpServer())
        .get(`/households/${fakeId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(404);
    });

    it('should deny access without authentication', () => {
      return request(app.getHttpServer())
        .get(`/households/${testHousehold.id}`)
        .expect(401);
    });

    it('should return 400 for invalid UUID', () => {
      return request(app.getHttpServer())
        .get('/households/invalid-uuid')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(400);
    });
  });

  describe('/households/:id/stats (GET)', () => {
    it('should get household statistics', () => {
      return request(app.getHttpServer())
        .get(`/households/${testHousehold.id}/stats`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('memberCount');
          expect(res.body).toHaveProperty('totalIncome');
          expect(res.body).toHaveProperty('totalExpenses');
          expect(res.body).toHaveProperty('netIncome');
          expect(res.body).toHaveProperty('status');
          expect(typeof res.body.memberCount).toBe('number');
          expect(typeof res.body.totalIncome).toBe('number');
          expect(typeof res.body.totalExpenses).toBe('number');
          expect(typeof res.body.netIncome).toBe('number');
        });
    });
  });

  describe('/households/:id (PATCH)', () => {
    it('should update household when user is admin', () => {
      return request(app.getHttpServer())
        .patch(`/households/${testHousehold.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Household Name',
          description: 'Updated description',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Updated Household Name');
          expect(res.body.description).toBe('Updated description');
        });
    });

    it('should update household when user is household admin', () => {
      return request(app.getHttpServer())
        .patch(`/households/${testHousehold.id}`)
        .set('Authorization', `Bearer ${householdAdminToken}`)
        .send({
          default_currency: 'GBP',
        })
        .expect(200);
    });

    it('should deny access for regular members', () => {
      return request(app.getHttpServer())
        .patch(`/households/${testHousehold.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          name: 'Member Update Attempt',
        })
        .expect(403);
    });
  });

  describe('/households/:id/activate (PATCH)', () => {
    it('should activate household when user is admin', () => {
      return request(app.getHttpServer())
        .patch(`/households/${testHousehold.id}/activate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe(HouseholdStatus.ACTIVE);
        });
    });

    it('should activate household when user is household admin', () => {
      return request(app.getHttpServer())
        .patch(`/households/${testHousehold.id}/activate`)
        .set('Authorization', `Bearer ${householdAdminToken}`)
        .expect(200);
    });

    it('should deny access for regular members', () => {
      return request(app.getHttpServer())
        .patch(`/households/${testHousehold.id}/activate`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });
  });

  describe('/households/:id/suspend (PATCH)', () => {
    it('should suspend household when user is admin', () => {
      return request(app.getHttpServer())
        .patch(`/households/${testHousehold.id}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe(HouseholdStatus.SUSPENDED);
        });
    });

    it('should deny access for household admin (only system admin can suspend)', () => {
      return request(app.getHttpServer())
        .patch(`/households/${testHousehold.id}/suspend`)
        .set('Authorization', `Bearer ${householdAdminToken}`)
        .expect(403);
    });
  });

  describe('/households/:id (DELETE)', () => {
    let emptyHousehold: TestHousehold;

    beforeEach(async () => {
      // Create an empty household for deletion tests
      emptyHousehold = await TestHelper.createTestHousehold(householdRepository, {
        name: 'Empty Household',
        member_count: 0,
      });
    });

    it('should delete empty household when user is admin', () => {
      return request(app.getHttpServer())
        .delete(`/households/${emptyHousehold.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('should prevent deletion of household with members', () => {
      return request(app.getHttpServer())
        .delete(`/households/${testHousehold.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toContain('active members');
        });
    });

    it('should deny access for regular members', () => {
      return request(app.getHttpServer())
        .delete(`/households/${emptyHousehold.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });
  });
});
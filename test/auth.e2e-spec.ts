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

describe('Auth Controller (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let userRepository: Repository<User>;
  let householdRepository: Repository<Household>;
  let jwtService: JwtService;
  let testHousehold: TestHousehold;
  let testUser: TestUser;

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

    // Create test household and user
    testHousehold = await TestHelper.createTestHousehold(householdRepository);
    testUser = await TestHelper.createTestUser(userRepository, testHousehold);
  });

  afterEach(async () => {
    await TestHelper.cleanupDatabase(module);
    await app.close();
  });

  describe('/auth/register (POST)', () => {
    it('should register new user successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'password123',
          first_name: 'New',
          last_name: 'User',
          household_name: 'New Household',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token');
          expect(res.body).toHaveProperty('user');
          expect(res.body.user.email).toBe('newuser@example.com');
          expect(res.body.user.first_name).toBe('New');
          expect(res.body.user.last_name).toBe('User');
          expect(res.body.user.role).toBe(UserRole.HOUSEHOLD_ADMIN);
        });
    });

    it('should register user with default household when no household_name provided', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'defaultuser@example.com',
          password: 'password123',
          first_name: 'Default',
          last_name: 'User',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.user).toHaveProperty('household_id');
        });
    });

    it('should return 409 when email already exists', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: testUser.email,
          password: 'password123',
          first_name: 'Duplicate',
          last_name: 'User',
        })
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toContain('already exists');
        });
    });

    it('should return 400 for invalid input', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: '123', // Too short
          first_name: '',
          last_name: '',
        })
        .expect(400);
    });
  });

  describe('/auth/login (POST)', () => {
    it('should login successfully with valid credentials', async () => {
      // First register a user to test login
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'logintest@example.com',
          password: 'password123',
          first_name: 'Login',
          last_name: 'Test',
        })
        .expect(201);

      // Then test login
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'password123',
        })
        .expect(200);
        
      expect(loginResponse.body).toHaveProperty('access_token');
      expect(loginResponse.body).toHaveProperty('user');
      expect(loginResponse.body.user.email).toBe('logintest@example.com');
    });

    it('should return 401 for invalid email', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid credentials');
        });
    });

    it('should return 401 for invalid password', async () => {
      // First register a user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'wrongpassword@example.com',
          password: 'correctpassword',
          first_name: 'Wrong',
          last_name: 'Password',
        })
        .expect(201);

      // Then try with wrong password
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'wrongpassword@example.com',
          password: 'wrongpassword',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid credentials');
        });
    });

    it('should return 400 for missing fields', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          // missing password
        })
        .expect(400);
    });
  });

  describe('/auth/profile (GET)', () => {
    it('should return user profile with valid token', async () => {
      // Register and get token
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'profile@example.com',
          password: 'password123',
          first_name: 'Profile',
          last_name: 'Test',
        })
        .expect(201);

      const token = registerResponse.body.access_token;

      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body.user.email).toBe('profile@example.com');
        });
    });

    it('should return 401 without token', () => {
      return request(app.getHttpServer())
        .get('/auth/profile')
        .expect(401);
    });

    it('should return 401 with invalid token', () => {
      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('/auth/keycloak/login (GET)', () => {
    it('should redirect to Keycloak login URL', () => {
      return request(app.getHttpServer())
        .get('/auth/keycloak/login')
        .expect(302)
        .expect((res) => {
          expect(res.headers.location).toMatch(/realms\/.*\/protocol\/openid_connect\/auth/);
        });
    });

    it('should include custom redirect_uri in Keycloak URL', () => {
      const customRedirectUri = 'http://localhost:3000/custom/callback';
      
      return request(app.getHttpServer())
        .get('/auth/keycloak/login')
        .query({ redirect_uri: customRedirectUri })
        .expect(302)
        .expect((res) => {
          expect(res.headers.location).toMatch(/redirect_uri.*custom%2Fcallback/);
        });
    });
  });

  describe('/auth/keycloak/logout (GET)', () => {
    it('should redirect to Keycloak logout URL', () => {
      return request(app.getHttpServer())
        .get('/auth/keycloak/logout')
        .expect(302)
        .expect((res) => {
          expect(res.headers.location).toMatch(/realms\/.*\/protocol\/openid_connect\/logout/);
        });
    });

    it('should include custom redirect_uri in logout URL', () => {
      const customRedirectUri = 'http://localhost:3000/logged-out';
      
      return request(app.getHttpServer())
        .get('/auth/keycloak/logout')
        .query({ redirect_uri: customRedirectUri })
        .expect(302)
        .expect((res) => {
          expect(res.headers.location).toMatch(/post_logout_redirect_uri.*logged-out/);
        });
    });
  });
});
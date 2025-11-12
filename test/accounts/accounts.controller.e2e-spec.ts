import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { User, UserRole } from '../../src/users/entities/user.entity';
import { Household, HouseholdStatus } from '../../src/households/entities/household.entity';
import { Account, AccountType, AccountStatus } from '../../src/accounts/entities/account.entity';
import { testDatabaseConfig } from '../test-database.config';
import { TestHelper, TestUser, TestHousehold } from '../test-helper';

describe('AccountsController (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let userRepository: Repository<User>;
  let householdRepository: Repository<Household>;
  let accountRepository: Repository<Account>;
  let jwtService: JwtService;
  let testHousehold: TestHousehold;
  let testUser: TestUser;
  let authToken: string;
  
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
    accountRepository = module.get<Repository<Account>>(getRepositoryToken(Account));
    jwtService = module.get<JwtService>(JwtService);

    // Create test household and user
    testHousehold = await TestHelper.createTestHousehold(householdRepository);
    testUser = await TestHelper.createHouseholdAdminUser(userRepository, testHousehold);
    authToken = TestHelper.generateJwtToken(testUser, jwtService);
  });

  afterEach(async () => {
    await TestHelper.cleanupDatabase(module);
    await app.close();
  });

  describe('POST /accounts', () => {
    it('should create a new checking account', async () => {
      const createAccountDto = {
        name: 'Primary Checking',
        account_type: AccountType.CHECKING,
        current_balance: 1500.00,
        bank_name: 'Test Bank',
        account_number: '****1234',
        routing_number: '123456789',
        description: 'Main household checking account',
      };

      const response = await request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createAccountDto)
        .expect(201);

      expect(response.body).toMatchObject({
        name: createAccountDto.name,
        account_type: createAccountDto.account_type,
        current_balance: "1500.00",
        bank_name: createAccountDto.bank_name,
        currency: 'USD',
        status: AccountStatus.ACTIVE,
        household_id: testHousehold.id,
      });
      expect(response.body.id).toBeDefined();
    });

    it('should create a credit card account with credit limit', async () => {
      const createCreditCardDto = {
        name: 'Main Credit Card',
        account_type: AccountType.CREDIT_CARD,
        current_balance: -250.00,
        credit_limit: 5000.00,
        bank_name: 'Credit Union',
        account_number: '****5678',
      };

      const response = await request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createCreditCardDto)
        .expect(201);

      expect(response.body).toMatchObject({
        name: createCreditCardDto.name,
        account_type: createCreditCardDto.account_type,
        current_balance: '-250.00', // PostgreSQL returns formatted string
        credit_limit: 5000, // This comes back as number
      });
    });

    it('should reject credit card without credit limit', async () => {
      const invalidCreditCardDto = {
        name: 'Invalid Credit Card',
        account_type: AccountType.CREDIT_CARD,
        current_balance: 0,
        bank_name: 'Test Bank',
      };

      await request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidCreditCardDto)
        .expect(400)
        .expect(res => {
          expect(res.body.message).toContain('Credit limit is required');
        });
    });

    it('should reject duplicate account name in same household', async () => {
      const accountDto = {
        name: 'Duplicate Account',
        account_type: AccountType.CHECKING,
        current_balance: 1000,
        bank_name: 'Test Bank',
      };

      // Create first account
      await request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(accountDto)
        .expect(201);

      // Try to create duplicate
      await request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(accountDto)
        .expect(409)
        .expect(res => {
          expect(res.body.message).toContain('Account with this name already exists');
        });
    });

    it('should require authentication', async () => {
      const createAccountDto = {
        name: 'Test Account',
        account_type: AccountType.CHECKING,
        current_balance: 1000,
      };

      await request(app.getHttpServer())
        .post('/accounts')
        .send(createAccountDto)
        .expect(401);
    });

    it('should validate required fields', async () => {
      await request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400)
        .expect(res => {
          const messages = Array.isArray(res.body.message) 
            ? res.body.message.join(' ')
            : res.body.message;
          expect(messages).toContain('name');
          expect(messages).toContain('account_type');
        });
    });
  });

  async function createTestAccounts() {
    const accounts = [
      {
        name: 'Checking Account',
        account_type: AccountType.CHECKING,
        current_balance: 1500.00,
        bank_name: 'Bank A',
      },
      {
        name: 'Savings Account',
        account_type: AccountType.SAVINGS,
        current_balance: 5000.00,
        bank_name: 'Bank B',
      },
      {
        name: 'Credit Card',
        account_type: AccountType.CREDIT_CARD,
        current_balance: -500.00,
        credit_limit: 3000.00,
        bank_name: 'Bank C',
      },
    ];

    for (const account of accounts) {
      await request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(account);
    }
  }

  describe('GET /accounts', () => {
    beforeEach(async () => {
      await createTestAccounts();
    });

    it('should return all accounts for household', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.accounts).toHaveLength(3);
      expect(response.body.total).toBe(3);
      expect(response.body.page).toBe(1);
      expect(response.body.totalPages).toBe(1);
    });

    it('should filter by account type', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounts')
        .query({ account_type: AccountType.CHECKING })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.accounts).toHaveLength(1);
      expect(response.body.accounts[0].account_type).toBe(AccountType.CHECKING);
    });

    it('should search by name and bank', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounts')
        .query({ search: 'Bank A' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.accounts).toHaveLength(1);
      expect(response.body.accounts[0].bank_name).toBe('Bank A');
    });

    it('should paginate results', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounts')
        .query({ page: 1, limit: 2 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.accounts).toHaveLength(2);
      expect(response.body.page).toBe(1);
      expect(response.body.totalPages).toBe(2);
    });
  });

  describe('GET /accounts/summary', () => {
    beforeEach(async () => {
      const accounts = [
        { name: 'Checking 1', account_type: AccountType.CHECKING, current_balance: 1000 },
        { name: 'Checking 2', account_type: AccountType.CHECKING, current_balance: 1500 },
        { name: 'Savings 1', account_type: AccountType.SAVINGS, current_balance: 5000 },
      ];

      for (const account of accounts) {
        await request(app.getHttpServer())
          .post('/accounts')
          .set('Authorization', `Bearer ${authToken}`)
          .send(account);
      }
    });

    it('should return account summary', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounts/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        total_accounts: 3,
        total_balance: 7500,
        accounts_by_type: {
          [AccountType.CHECKING]: 2,
          [AccountType.SAVINGS]: 1,
        },
        accounts_by_currency: {
          'USD': 7500,
        },
      });
    });
  });

  async function createSingleAccount(): Promise<string> {
    const createResponse = await request(app.getHttpServer())
      .post('/accounts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Account',
        account_type: AccountType.CHECKING,
        current_balance: 1000,
      });

    return createResponse.body.id;
  }

  describe('GET /accounts/:id', () => {
    let accountId: string;

    beforeEach(async () => {
      accountId = await createSingleAccount();
    });

    it('should return account by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/accounts/${accountId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(accountId);
      expect(response.body.name).toBe('Test Account');
    });

    it('should return 404 for non-existent account', async () => {
      await request(app.getHttpServer())
        .get('/accounts/123e4567-e89b-12d3-a456-426614174000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should reject invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/accounts/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('PATCH /accounts/:id', () => {
    let accountId: string;

    beforeEach(async () => {
      accountId = await createSingleAccount();
    });

    it('should update account successfully', async () => {
      const updateDto = {
        name: 'Updated Account Name',
        description: 'Updated description',
      };

      const response = await request(app.getHttpServer())
        .patch(`/accounts/${accountId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.name).toBe('Updated Account Name');
      expect(response.body.description).toBe('Updated description');
    });

    it('should close account when status is set to closed', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/accounts/${accountId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: AccountStatus.CLOSED })
        .expect(200);

      expect(response.body.status).toBe(AccountStatus.CLOSED);
      expect(response.body.closing_date).toBeDefined();
    });

    it('should reject duplicate name', async () => {
      // Create another account
      await request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Another Account',
          account_type: AccountType.SAVINGS,
          current_balance: 2000,
        });

      // Try to update first account with same name
      await request(app.getHttpServer())
        .patch(`/accounts/${accountId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Another Account' })
        .expect(409);
    });
  });

  describe('DELETE /accounts/:id', () => {
    let accountId: string;

    beforeEach(async () => {
      accountId = await createSingleAccount();
    });

    it('should soft delete account (household admin)', async () => {
      await request(app.getHttpServer())
        .delete(`/accounts/${accountId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify account is not returned in list
      const response = await request(app.getHttpServer())
        .get('/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.accounts).toHaveLength(0);
    });

    it('should require household admin role for deletion', async () => {
      // Create a member user with different permissions
      const memberUser = await TestHelper.createTestUser(userRepository, testHousehold, {
        email: 'member@test.com',
        role: UserRole.MEMBER,
      });
      const memberToken = TestHelper.generateJwtToken(memberUser, jwtService);

      await request(app.getHttpServer())
        .delete(`/accounts/${accountId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });
  });

  describe('PATCH /accounts/:id/balance', () => {
    let accountId: string;

    beforeEach(async () => {
      accountId = await createSingleAccount();
    });

    it('should update account balance', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/accounts/${accountId}/balance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          current_balance: 1500.00,
          available_balance: 1450.00,
        })
        .expect(200);

      expect(response.body.current_balance).toBe(1500);
      expect(response.body.available_balance).toBe(1450);
      expect(response.body.last_synced_at).toBeDefined();
    });

    it('should set available balance to current balance if not provided', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/accounts/${accountId}/balance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ current_balance: 2000.00 })
        .expect(200);

      expect(response.body.current_balance).toBe(2000);
      expect(response.body.available_balance).toBe(2000);
    });

    it('should require current_balance field', async () => {
      await request(app.getHttpServer())
        .patch(`/accounts/${accountId}/balance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ available_balance: 1000 })
        .expect(400);
    });
  });

  describe('Account status operations', () => {
    let accountId: string;

    beforeEach(async () => {
      accountId = await createSingleAccount();
    });

    it('should activate account', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/accounts/${accountId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe(AccountStatus.ACTIVE);
    });

    it('should close account', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/accounts/${accountId}/close`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe(AccountStatus.CLOSED);
      expect(response.body.closing_date).toBeDefined();
    });

    it('should suspend account (admin only)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/accounts/${accountId}/suspend`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe(AccountStatus.SUSPENDED);
    });

    it('should reject member suspension attempt', async () => {
      const memberUser = await TestHelper.createTestUser(userRepository, testHousehold, {
        email: 'member@test.com',
        role: UserRole.MEMBER,
      });
      const memberToken = TestHelper.generateJwtToken(memberUser, jwtService);

      await request(app.getHttpServer())
        .patch(`/accounts/${accountId}/suspend`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });
  });

  describe('Multi-tenant isolation', () => {
    it('should not see accounts from other households', async () => {
      // Create account in current household
      await request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Household 1 Account',
          account_type: AccountType.CHECKING,
          current_balance: 1000,
        });

      // Create another household and user
      const otherHousehold = await TestHelper.createTestHousehold(householdRepository, {
        name: 'Other Household',
      });
      const otherUser = await TestHelper.createHouseholdAdminUser(userRepository, otherHousehold);
      const otherToken = TestHelper.generateJwtToken(otherUser, jwtService);

      // Create account in other household
      await request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          name: 'Household 2 Account',
          account_type: AccountType.CHECKING,
          current_balance: 2000,
        });

      // Check that each household only sees their own accounts
      const household1Response = await request(app.getHttpServer())
        .get('/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const household2Response = await request(app.getHttpServer())
        .get('/accounts')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      expect(household1Response.body.accounts).toHaveLength(1);
      expect(household1Response.body.accounts[0].name).toBe('Household 1 Account');

      expect(household2Response.body.accounts).toHaveLength(1);
      expect(household2Response.body.accounts[0].name).toBe('Household 2 Account');
    });
  });
});
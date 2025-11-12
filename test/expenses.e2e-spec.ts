import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { ConfigModule } from '@nestjs/config';

describe('ExpensesController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let householdId: string;
  let accessToken: string;
  let accountId: string;
  let categoryId: string;

  const testUser = {
    email: 'test@example.com',
    password: 'testpassword123',
    first_name: 'Test',
    last_name: 'User',
    household_name: 'Test Household for Expenses',
  };

  const testHousehold = {
    name: 'Test Household',
    description: 'Test household for expenses',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Enable validation pipes with transform (matches runtime behavior)
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    
    await app.init();

    dataSource = app.get<DataSource>(DataSource);
    await dataSource.dropDatabase();
    await dataSource.synchronize();
    await dataSource.runMigrations();
  });

  beforeEach(async () => {
    // Clear specific records instead of entire database
    try {
      await dataSource.query('DELETE FROM transactions WHERE 1=1;');
      await dataSource.query('DELETE FROM categories WHERE 1=1;');
      await dataSource.query('DELETE FROM accounts WHERE 1=1;');
      await dataSource.query('DELETE FROM users WHERE email = $1;', [testUser.email]);
      await dataSource.query('DELETE FROM households WHERE name = $1;', [testUser.household_name]);
    } catch (error) {
      console.warn('Database cleanup warning:', error.message);
    }

    // Create test user (this will also create the household)
    const userResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser)
      .expect(201);

    // Login to get access token  
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .expect(200);

    accessToken = loginResponse.body.access_token;
    householdId = userResponse.body.user.household_id;

    // Create test account
    const accountResponse = await request(app.getHttpServer())
      .post('/accounts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Test Account',
        account_type: 'checking',
        currency: 'USD',
        current_balance: 1000.00,
      })
      .expect(201);

    accountId = accountResponse.body.id;

    // Create test category
    const categoryResponse = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Test Category',
        category_type: 'expense',
        color: '#FF0000',
        icon: 'shopping-cart',
      })
      .expect(201);

    categoryId = categoryResponse.body.id;
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  describe('POST /transactions', () => {
    it('should create a new transaction', async () => {
      const transactionData = {
        account_id: accountId,
        category_id: categoryId,
        amount: 50.00,
        transaction_type: 'expense',
        description: 'Test expense transaction',
        date: '2025-01-01',
        currency: 'USD',
      };

      const response = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(transactionData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.amount).toBe(transactionData.amount);
      expect(response.body.description).toBe(transactionData.description);
      expect(response.body.transaction_type).toBe(transactionData.transaction_type);
    });

    it('should return 400 for invalid transaction data', async () => {
      const invalidData = {
        account_id: accountId,
        amount: -50.00, // Invalid negative amount
        transaction_type: 'expense',
        description: 'Invalid transaction',
      };

      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('should return 404 for non-existent account', async () => {
      const transactionData = {
        account_id: '00000000-0000-0000-0000-000000000000',
        amount: 50.00,
        transaction_type: 'expense',
        description: 'Test transaction',
        date: '2025-01-01',
      };

      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(transactionData)
        .expect(404);
    });
  });

  describe('GET /transactions', () => {
    it('should retrieve all transactions for household', async () => {
      // Create test transactions
      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          account_id: accountId,
          amount: 100.00,
          transaction_type: 'expense',
          description: 'First transaction',
          date: '2025-01-01',
        });

      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          account_id: accountId,
          amount: 200.00,
          transaction_type: 'income',
          description: 'Second transaction',
          date: '2025-01-02',
        });

      const response = await request(app.getHttpServer())
        .get('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('transactions');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.transactions).toHaveLength(2);
      expect(response.body.meta.total).toBe(2);
    });

    it('should filter transactions by type', async () => {
      // Create transactions of different types
      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          account_id: accountId,
          amount: 100.00,
          transaction_type: 'expense',
          description: 'Expense transaction',
          date: '2025-01-01',
        });

      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          account_id: accountId,
          amount: 200.00,
          transaction_type: 'income',
          description: 'Income transaction',
          date: '2025-01-02',
        });

      const response = await request(app.getHttpServer())
        .get('/transactions?transaction_type=expense')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.transactions).toHaveLength(1);
      expect(response.body.transactions[0].transaction_type).toBe('expense');
    });
  });

  describe('PATCH /transactions/:id', () => {
    it('should update a transaction', async () => {
      // First create a transaction
      const createResponse = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          account_id: accountId,
          amount: 100.00,
          transaction_type: 'expense',
          description: 'Original description',
          date: '2025-01-01',
        })
        .expect(201);

      const transactionId = createResponse.body.id;
      expect(transactionId).toBeDefined();

      // Update the transaction
      const updateData = {
        amount: 150.00,
        description: 'Updated description',
      };

      const updateResponse = await request(app.getHttpServer())
        .patch(`/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.amount).toBe(updateData.amount);
      expect(updateResponse.body.description).toBe(updateData.description);
    });
  });

  describe('DELETE /transactions/:id', () => {
    it('should delete a transaction', async () => {
      // Create a transaction
      const createResponse = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          account_id: accountId,
          amount: 100.00,
          transaction_type: 'expense',
          description: 'To be deleted',
          date: '2025-01-01',
        })
        .expect(201);

      const transactionId = createResponse.body.id;

      // Delete the transaction
      await request(app.getHttpServer())
        .delete(`/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Verify it's deleted
      await request(app.getHttpServer())
        .get(`/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('POST /categories', () => {
    it('should create a new category', async () => {
      const categoryData = {
        name: 'New Test Category',
        category_type: 'expense',
        color: '#00FF00',
        icon: 'home',
        description: 'A test category',
      };

      const response = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(categoryData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(categoryData.name);
      expect(response.body.category_type).toBe(categoryData.category_type);
      expect(response.body.color).toBe(categoryData.color);
    });

    it('should return 409 for duplicate category name', async () => {
      const categoryData = {
        name: 'Test Category', // This name already exists from beforeEach
        category_type: 'expense',
        color: '#00FF00',
      };

      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(categoryData)
        .expect(409);
    });
  });

  describe('GET /categories', () => {
    it('should retrieve all categories for household', async () => {
      const response = await request(app.getHttpServer())
        .get('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('categories');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.categories.length).toBeGreaterThan(0);
    });

    it('should filter categories by type', async () => {
      // Create an income category
      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Income Category',
          category_type: 'income',
          color: '#0000FF',
        });

      const response = await request(app.getHttpServer())
        .get('/categories?category_type=income')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.categories).toHaveLength(1);
      expect(response.body.categories[0].category_type).toBe('income');
    });
  });

  describe('POST /categories/defaults', () => {
    it('should create default categories', async () => {
      // First clear existing categories
      await dataSource.query('DELETE FROM categories WHERE household_id = $1', [householdId]);

      const response = await request(app.getHttpServer())
        .post('/categories/defaults')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Check that we have both expense and income categories
      const expenseCategories = response.body.filter(cat => cat.category_type === 'expense');
      const incomeCategories = response.body.filter(cat => cat.category_type === 'income');
      
      expect(expenseCategories.length).toBeGreaterThan(0);
      expect(incomeCategories.length).toBeGreaterThan(0);
    });
  });

  describe('GET /categories/hierarchy', () => {
    it('should return categories in hierarchical structure', async () => {
      // Create a parent category and subcategory
      const parentResponse = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Parent Category',
          category_type: 'expense',
          color: '#FF0000',
        });

      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Sub Category',
          category_type: 'expense',
          color: '#FF0000',
          parent_id: parentResponse.body.id,
        });

      const response = await request(app.getHttpServer())
        .get('/categories/hierarchy')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // Find the parent category
      const parentCategory = response.body.find(cat => cat.name === 'Parent Category');
      expect(parentCategory).toBeDefined();
      expect(parentCategory.subcategories).toBeDefined();
      expect(parentCategory.subcategories.length).toBeGreaterThan(0);
    });
  });
});
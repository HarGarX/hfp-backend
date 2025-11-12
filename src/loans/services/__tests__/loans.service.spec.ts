import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LoansService } from '../loans.service';
import { Loan, LoanType, LoanStatus, PaymentFrequency } from '../../entities/loan.entity';
import { LoanPayment, PaymentType, PaymentStatus, PaymentMethod } from '../../entities/loan-payment.entity';
import { CreateLoanDto, UpdateLoanDto, CreateLoanPaymentDto } from '../../dto';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

describe('LoansService', () => {
  let service: LoansService;
  let loanRepository: jest.Mocked<Repository<Loan>>;
  let paymentRepository: jest.Mocked<Repository<LoanPayment>>;

  const mockLoan = {
    id: 'loan-1',
    household_id: 'household-1',
    user_id: 'user-1',
    name: 'Test Mortgage',
    description: 'Primary residence mortgage',
    type: LoanType.MORTGAGE,
    status: LoanStatus.ACTIVE,
    principal_amount: 250000,
    current_balance: 235000,
    interest_rate: 0.0575,
    payment_frequency: PaymentFrequency.MONTHLY,
    payment_amount: 1200,
    start_date: new Date('2023-01-15'),
    maturity_date: new Date('2053-01-15'),
    next_payment_date: new Date('2024-02-15'),
    last_payment_date: new Date('2024-01-15'),
    payments_made: 12,
    total_interest_paid: 4800,
    total_fees_paid: 0,
    late_fee_amount: 25,
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
    monthly_payment_equivalent: 1200,
  } as any;

  const mockPayment = {
    id: 'payment-1',
    household_id: 'household-1',
    user_id: 'user-1',
    loan_id: 'loan-1',
    amount: 1200,
    principal_amount: 800,
    interest_amount: 400,
    fee_amount: 0,
    type: PaymentType.REGULAR,
    status: PaymentStatus.COMPLETED,
    payment_method: PaymentMethod.BANK_TRANSFER,
    payment_date: new Date('2024-01-15'),
    due_date: new Date('2024-01-15'),
    reference_number: 'PAY-001',
    description: 'Monthly payment',
    balance_after: 235000,
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
  } as any;

  const mockLoanRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockPaymentRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansService,
        {
          provide: getRepositoryToken(Loan),
          useValue: mockLoanRepository,
        },
        {
          provide: getRepositoryToken(LoanPayment),
          useValue: mockPaymentRepository,
        },
      ],
    }).compile();

    service = module.get<LoansService>(LoansService);
    loanRepository = module.get(getRepositoryToken(Loan));
    paymentRepository = module.get(getRepositoryToken(LoanPayment));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a loan successfully', async () => {
      const createLoanDto: CreateLoanDto = {
        name: 'Test Mortgage',
        description: 'Primary residence mortgage',
        type: LoanType.MORTGAGE,
        principal_amount: 250000,
        current_balance: 235000,
        interest_rate: 0.0575,
        payment_frequency: PaymentFrequency.MONTHLY,
        payment_amount: 1200,
        start_date: '2023-01-15',
        next_payment_date: '2024-02-15',
      };

      loanRepository.create.mockReturnValue(mockLoan);
      loanRepository.save.mockResolvedValue(mockLoan);

      const result = await service.create(createLoanDto, 'user-1', 'household-1');

      expect(loanRepository.create).toHaveBeenCalledWith({
        ...createLoanDto,
        current_balance: createLoanDto.current_balance,
        user_id: 'user-1',
        household_id: 'household-1',
        payments_made: 0,
        total_fees_paid: 0,
        total_interest_paid: 0,
      });
      expect(loanRepository.save).toHaveBeenCalledWith(mockLoan);
      expect(result).toEqual(mockLoan);
    });

    it('should set current balance to principal amount if not provided', async () => {
      const createLoanDto: CreateLoanDto = {
        name: 'Test Loan',
        type: LoanType.PERSONAL,
        principal_amount: 10000,
        start_date: '2023-01-15',
      };

      loanRepository.create.mockReturnValue(mockLoan);
      loanRepository.save.mockResolvedValue(mockLoan);

      await service.create(createLoanDto, 'user-1', 'household-1');

      expect(loanRepository.create).toHaveBeenCalledWith({
        ...createLoanDto,
        current_balance: createLoanDto.principal_amount,
        user_id: 'user-1',
        household_id: 'household-1',
        payments_made: 0,
        total_fees_paid: 0,
        total_interest_paid: 0,
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated loans', async () => {
      const paginationDto = new PaginationDto();
      paginationDto.page = 1;
      paginationDto.limit = 10;

      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockLoan], 1]),
      };

      loanRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      const result = await service.findAll('household-1', paginationDto);

      expect(loanRepository.createQueryBuilder).toHaveBeenCalledWith('loan');
      expect(queryBuilder.where).toHaveBeenCalledWith('loan.household_id = :householdId', {
        householdId: 'household-1',
      });
      expect(result).toEqual({ loans: [mockLoan], total: 1 });
    });

    it('should apply filters when provided', async () => {
      const paginationDto = new PaginationDto();
      paginationDto.page = 1;
      paginationDto.limit = 10;

      const filters = {
        type: LoanType.MORTGAGE,
        status: LoanStatus.ACTIVE,
        user_id: 'user-1',
      };

      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockLoan], 1]),
      };

      loanRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      await service.findAll('household-1', paginationDto, filters);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('loan.type = :type', {
        type: filters.type,
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('loan.status = :status', {
        status: filters.status,
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('loan.user_id = :userId', {
        userId: filters.user_id,
      });
    });
  });

  describe('findOne', () => {
    it('should return a loan if found', async () => {
      loanRepository.findOne.mockResolvedValue(mockLoan);

      const result = await service.findOne('loan-1', 'household-1');

      expect(loanRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'loan-1', household_id: 'household-1' },
        relations: ['user', 'account'],
      });
      expect(result).toEqual(mockLoan);
    });

    it('should throw NotFoundException if loan not found', async () => {
      loanRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('loan-1', 'household-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a loan successfully', async () => {
      const updateLoanDto: UpdateLoanDto = {
        name: 'Updated Loan',
        current_balance: 230000,
      };

      loanRepository.findOne.mockResolvedValue(mockLoan);
      
      const updatedLoan = { ...mockLoan, ...updateLoanDto };
      loanRepository.save.mockResolvedValue(updatedLoan as any);

      const result = await service.update('loan-1', updateLoanDto, 'household-1');

      expect(loanRepository.save).toHaveBeenCalled();
      expect(result).toEqual(updatedLoan);
    });

    it('should throw NotFoundException if loan not found', async () => {
      loanRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('loan-1', {}, 'household-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a loan successfully', async () => {
      loanRepository.findOne.mockResolvedValue(mockLoan);
      loanRepository.remove.mockResolvedValue(mockLoan);

      await service.remove('loan-1', 'household-1');

      expect(loanRepository.remove).toHaveBeenCalledWith(mockLoan);
    });

    it('should throw NotFoundException if loan not found', async () => {
      loanRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('loan-1', 'household-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSummary', () => {
    it('should return loan portfolio summary', async () => {
      const loans = [
        { ...mockLoan },
        {
          ...mockLoan,
          id: 'loan-2',
          type: LoanType.PERSONAL,
          current_balance: 15000,
          payment_amount: 500,
          monthly_payment_equivalent: 500,
        },
      ];

      loanRepository.find.mockResolvedValue(loans as Loan[]);

      const result = await service.getSummary('household-1');

      expect(result).toMatchObject({
        total_loans: 2,
        total_debt: expect.any(Number),
        monthly_payment_total: expect.any(Number),
        average_interest_rate: expect.any(Number),
        breakdown_by_type: expect.any(Object),
      });
    });
  });

  describe('getPayoffProjection', () => {
    it('should calculate payoff projection', async () => {
      loanRepository.findOne.mockResolvedValue(mockLoan);

      const result = await service.getPayoffProjection('loan-1', 'household-1');

      expect(result).toMatchObject({
        loan_id: 'loan-1',
        current_balance: expect.any(Number),
        estimated_payoff_date: expect.any(String),
        total_interest_remaining: expect.any(Number),
        total_amount_remaining: expect.any(Number),
        payments_remaining: expect.any(Number),
        monthly_payment: expect.any(Number),
      });
    });

    it('should throw BadRequestException if no payment amount', async () => {
      const loanWithoutPayment = { ...mockLoan, payment_amount: null };
      loanRepository.findOne.mockResolvedValue(loanWithoutPayment as any);

      await expect(
        service.getPayoffProjection('loan-1', 'household-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createPayment', () => {
    it('should create a payment successfully', async () => {
      const createPaymentDto: CreateLoanPaymentDto = {
        loan_id: 'loan-1',
        amount: 1200,
        principal_amount: 800,
        interest_amount: 400,
        fee_amount: 0,
        payment_date: '2024-01-15',
      };

      loanRepository.findOne.mockResolvedValue(mockLoan);
      paymentRepository.create.mockReturnValue(mockPayment);
      paymentRepository.save.mockResolvedValue(mockPayment);
      loanRepository.save.mockResolvedValue(mockLoan);

      const result = await service.createPayment(
        createPaymentDto,
        'user-1',
        'household-1',
      );

      expect(paymentRepository.create).toHaveBeenCalledWith({
        ...createPaymentDto,
        user_id: 'user-1',
        household_id: 'household-1',
      });
      expect(paymentRepository.save).toHaveBeenCalledWith(mockPayment);
      expect(result).toEqual(mockPayment);
    });

    it('should throw BadRequestException if payment breakdown does not match total', async () => {
      const createPaymentDto: CreateLoanPaymentDto = {
        loan_id: 'loan-1',
        amount: 1200,
        principal_amount: 700, // This doesn't add up to 1200
        interest_amount: 400,
        fee_amount: 0,
        payment_date: '2024-01-15',
      };

      loanRepository.findOne.mockResolvedValue(mockLoan);

      await expect(
        service.createPayment(createPaymentDto, 'user-1', 'household-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findPayments', () => {
    it('should return paginated payments', async () => {
      const paginationDto = new PaginationDto();
      paginationDto.page = 1;
      paginationDto.limit = 10;

      loanRepository.findOne.mockResolvedValue(mockLoan);
      paymentRepository.findAndCount.mockResolvedValue([[mockPayment], 1]);

      const result = await service.findPayments(
        'loan-1',
        'household-1',
        paginationDto,
      );

      expect(paymentRepository.findAndCount).toHaveBeenCalledWith({
        where: { loan_id: 'loan-1', household_id: 'household-1' },
        relations: ['user'],
        order: { payment_date: 'DESC' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual({ payments: [mockPayment], total: 1 });
    });
  });

  describe('getPaymentSummary', () => {
    it('should return payment summary', async () => {
      loanRepository.findOne.mockResolvedValue(mockLoan);
      paymentRepository.find.mockResolvedValue([mockPayment]);

      const result = await service.getPaymentSummary('loan-1', 'household-1');

      expect(result).toMatchObject({
        loan_id: 'loan-1',
        total_payments: 1,
        total_amount_paid: expect.any(Number),
        total_principal_paid: expect.any(Number),
        total_interest_paid: expect.any(Number),
        total_fees_paid: expect.any(Number),
        monthly_breakdown: expect.any(Array),
      });
    });
  });
});
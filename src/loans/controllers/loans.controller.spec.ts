import { Test, TestingModule } from '@nestjs/testing';
import { LoansController } from './loans.controller';
import { LoansService } from '../services/loans.service';
import { 
  CreateLoanDto, 
  UpdateLoanDto, 
  LoanSummaryDto,
  PayoffProjectionDto,
  CreateLoanPaymentDto,
  UpdateLoanPaymentDto,
  LoanPaymentSummaryDto
} from '../dto';
import { Loan, LoanType, LoanStatus, PaymentFrequency } from '../entities/loan.entity';
import { LoanPayment, PaymentType } from '../entities/loan-payment.entity';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('LoansController', () => {
  let controller: LoansController;
  let service: jest.Mocked<LoansService>;

  const mockHouseholdId = 'household-123';
  const mockUserId = 'user-123';
  const mockLoanId = 'loan-123';

  const mockPagination: PaginationDto = {
    page: 1,
    limit: 10,
  };

  const mockLoan: Partial<Loan> = {
    id: mockLoanId,
    name: 'Car Loan',
    type: LoanType.AUTO,
    status: LoanStatus.ACTIVE,
    principal_amount: 25000,
    current_balance: 18000,
    interest_rate: 5.5,
    payment_amount: 450,
    payment_frequency: PaymentFrequency.MONTHLY,
    start_date: new Date('2023-01-01'),
    maturity_date: new Date('2028-01-01'),
    household_id: mockHouseholdId,
    user_id: mockUserId,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      getSummary: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getPayoffProjection: jest.fn(),
      createPayment: jest.fn(),
      findPayments: jest.fn(),
      getPaymentSummary: jest.fn(),
      updatePayment: jest.fn(),
      removePayment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoansController],
      providers: [
        {
          provide: LoansService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<LoansController>(LoansController);
    service = module.get(LoansService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateLoanDto = {
      name: 'Home Mortgage',
      type: LoanType.MORTGAGE,
      principal_amount: 350000,
      interest_rate: 3.75,
      payment_amount: 1620,
      start_date: '2023-01-01',
    };

    it('should create a loan successfully', async () => {
      service.create.mockResolvedValue(mockLoan as Loan);

      const result = await controller.create(createDto, mockUserId, mockHouseholdId);

      expect(service.create).toHaveBeenCalledWith(createDto, mockUserId, mockHouseholdId);
      expect(result).toEqual(mockLoan);
    });

    it('should handle BadRequestException for invalid input', async () => {
      service.create.mockRejectedValue(new BadRequestException('Invalid loan data'));

      await expect(controller.create(createDto, mockUserId, mockHouseholdId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    const mockLoansResponse = {
      loans: [mockLoan],
      total: 1,
    };

    it('should return paginated loans without filters', async () => {
      service.findAll.mockResolvedValue(mockLoansResponse as any);

      const result = await controller.findAll(mockHouseholdId, mockPagination);

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, mockPagination, {
        type: undefined,
        status: undefined,
        user_id: undefined,
      });
      expect(result).toEqual({
        loans: [mockLoan],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should return paginated loans with filters', async () => {
      service.findAll.mockResolvedValue(mockLoansResponse as any);

      const result = await controller.findAll(
        mockHouseholdId,
        mockPagination,
        LoanType.AUTO,
        LoanStatus.ACTIVE,
        mockUserId
      );

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, mockPagination, {
        type: LoanType.AUTO,
        status: LoanStatus.ACTIVE,
        user_id: mockUserId,
      });
      expect(result).toEqual({
        loans: [mockLoan],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });
  });

  describe('findOne', () => {
    it('should return a loan by id', async () => {
      service.findOne.mockResolvedValue(mockLoan as Loan);

      const result = await controller.findOne(mockLoanId, mockHouseholdId);

      expect(service.findOne).toHaveBeenCalledWith(mockLoanId, mockHouseholdId);
      expect(result).toEqual(mockLoan);
    });

    it('should handle NotFoundException', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Loan not found'));

      await expect(controller.findOne('nonexistent-id', mockHouseholdId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateLoanDto = {
      name: 'Updated Car Loan',
      status: LoanStatus.ACTIVE,
    };

    it('should update a loan successfully', async () => {
      const updatedLoan = { ...mockLoan, ...updateDto };
      service.update.mockResolvedValue(updatedLoan as Loan);

      const result = await controller.update(mockLoanId, updateDto, mockHouseholdId);

      expect(service.update).toHaveBeenCalledWith(mockLoanId, updateDto, mockHouseholdId);
      expect(result).toEqual(updatedLoan);
    });

    it('should handle NotFoundException', async () => {
      service.update.mockRejectedValue(new NotFoundException('Loan not found'));

      await expect(controller.update('nonexistent-id', updateDto, mockHouseholdId)).rejects.toThrow(NotFoundException);
    });

    it('should handle BadRequestException for invalid data', async () => {
      service.update.mockRejectedValue(new BadRequestException('Invalid update data'));

      await expect(controller.update(mockLoanId, updateDto, mockHouseholdId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove a loan successfully', async () => {
      service.remove.mockResolvedValue();

      const result = await controller.remove(mockLoanId, mockHouseholdId);

      expect(service.remove).toHaveBeenCalledWith(mockLoanId, mockHouseholdId);
      expect(result).toEqual({ message: 'Loan deleted successfully' });
    });

    it('should handle NotFoundException', async () => {
      service.remove.mockRejectedValue(new NotFoundException('Loan not found'));

      await expect(controller.remove('nonexistent-id', mockHouseholdId)).rejects.toThrow(NotFoundException);
    });
  });
});

describe('LoansController', () => {
  let controller: LoansController;
  let service: jest.Mocked<LoansService>;

  const mockHouseholdId = 'household-123';
  const mockUserId = 'user-123';
  const mockLoanId = 'loan-123';

  const mockPagination: PaginationDto = {
    page: 1,
    limit: 10,
  };

  const mockLoan: Partial<Loan> = {
    id: mockLoanId,
    name: 'Car Loan',
    type: LoanType.AUTO,
    status: LoanStatus.ACTIVE,
    principal_amount: 25000,
    current_balance: 18000,
    interest_rate: 5.5,
    payment_amount: 450,
    payment_frequency: PaymentFrequency.MONTHLY,
    start_date: new Date('2023-01-01'),
    maturity_date: new Date('2028-01-01'),
    household_id: mockHouseholdId,
    user_id: mockUserId,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockLoanPayment: Partial<LoanPayment> = {
    id: 'payment-123',
    loan_id: mockLoanId,
    amount: 450,
    payment_date: new Date('2023-12-01'),
    principal_amount: 375,
    interest_amount: 75,
    created_at: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      getSummary: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getPayoffProjection: jest.fn(),
      createPayment: jest.fn(),
      findPayments: jest.fn(),
      getPaymentSummary: jest.fn(),
      updatePayment: jest.fn(),
      removePayment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoansController],
      providers: [
        {
          provide: LoansService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<LoansController>(LoansController);
    service = module.get(LoansService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateLoanDto = {
      name: 'Home Mortgage',
      type: LoanType.MORTGAGE,
      principal_amount: 350000,
      interest_rate: 3.75,
      payment_amount: 1620,
      start_date: '2023-01-01',
    };

    it('should create a loan successfully', async () => {
      service.create.mockResolvedValue(mockLoan as Loan);

      const result = await controller.create(createDto, mockUserId, mockHouseholdId);

      expect(service.create).toHaveBeenCalledWith(createDto, mockUserId, mockHouseholdId);
      expect(result).toEqual(mockLoan);
    });

    it('should handle BadRequestException for invalid input', async () => {
      service.create.mockRejectedValue(new BadRequestException('Invalid loan data'));

      await expect(controller.create(createDto, mockUserId, mockHouseholdId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    const mockLoansResponse = {
      loans: [mockLoan],
      total: 1,
    };

    it('should return paginated loans without filters', async () => {
      service.findAll.mockResolvedValue(mockLoansResponse as any);

      const result = await controller.findAll(mockHouseholdId, mockPagination);

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, mockPagination, {
        type: undefined,
        status: undefined,
        user_id: undefined,
      });
      expect(result).toEqual({
        loans: [mockLoan],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should return paginated loans with filters', async () => {
      service.findAll.mockResolvedValue(mockLoansResponse as any);

      const result = await controller.findAll(
        mockHouseholdId,
        mockPagination,
        LoanType.AUTO,
        LoanStatus.ACTIVE,
        mockUserId
      );

      expect(service.findAll).toHaveBeenCalledWith(mockHouseholdId, mockPagination, {
        type: LoanType.AUTO,
        status: LoanStatus.ACTIVE,
        user_id: mockUserId,
      });
      expect(result).toEqual({
        loans: [mockLoan],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });
  });

  describe('getSummary', () => {
    const mockSummary: LoanSummaryDto = {
      total_loans: 3,
      total_debt: 350000,
      monthly_payment_total: 2500,
      total_interest_paid: 15000,
      total_fees_paid: 500,
      overdue_loans_count: 0,
      average_interest_rate: 4.2,
      breakdown_by_type: {
        [LoanType.MORTGAGE]: {
          count: 1,
          total_balance: 250000,
          monthly_payment: 1800,
        },
        [LoanType.AUTO]: {
          count: 1,
          total_balance: 75000,
          monthly_payment: 450,
        },
        [LoanType.PERSONAL]: {
          count: 1,
          total_balance: 25000,
          monthly_payment: 250,
        },
      },
      next_payment_date: '2024-01-01',
      next_payment_amount: 2500,
    };

    it('should return loan summary', async () => {
      service.getSummary.mockResolvedValue(mockSummary);

      const result = await controller.getSummary(mockHouseholdId);

      expect(service.getSummary).toHaveBeenCalledWith(mockHouseholdId);
      expect(result).toEqual(mockSummary);
    });
  });

  describe('findOne', () => {
    it('should return a loan by id', async () => {
      service.findOne.mockResolvedValue(mockLoan as Loan);

      const result = await controller.findOne(mockLoanId, mockHouseholdId);

      expect(service.findOne).toHaveBeenCalledWith(mockLoanId, mockHouseholdId);
      expect(result).toEqual(mockLoan);
    });

    it('should handle NotFoundException', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Loan not found'));

      await expect(controller.findOne('nonexistent-id', mockHouseholdId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateLoanDto = {
      name: 'Updated Car Loan',
      payment_amount: 475,
      status: LoanStatus.ACTIVE,
    };

    it('should update a loan successfully', async () => {
      const updatedLoan = { ...mockLoan, ...updateDto };
      service.update.mockResolvedValue(updatedLoan as Loan);

      const result = await controller.update(mockLoanId, updateDto, mockHouseholdId);

      expect(service.update).toHaveBeenCalledWith(mockLoanId, updateDto, mockHouseholdId);
      expect(result).toEqual(updatedLoan);
    });

    it('should handle NotFoundException', async () => {
      service.update.mockRejectedValue(new NotFoundException('Loan not found'));

      await expect(controller.update('nonexistent-id', updateDto, mockHouseholdId)).rejects.toThrow(NotFoundException);
    });

    it('should handle BadRequestException for invalid data', async () => {
      service.update.mockRejectedValue(new BadRequestException('Invalid update data'));

      await expect(controller.update(mockLoanId, updateDto, mockHouseholdId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove a loan successfully', async () => {
      service.remove.mockResolvedValue();

      const result = await controller.remove(mockLoanId, mockHouseholdId);

      expect(service.remove).toHaveBeenCalledWith(mockLoanId, mockHouseholdId);
      expect(result).toEqual({ message: 'Loan deleted successfully' });
    });

    it('should handle NotFoundException', async () => {
      service.remove.mockRejectedValue(new NotFoundException('Loan not found'));

      await expect(controller.remove('nonexistent-id', mockHouseholdId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPayoffProjection', () => {
    const mockProjection: PayoffProjectionDto = {
      loan_id: mockLoanId,
      current_balance: 18000,
      estimated_payoff_date: '2028-01-01',
      total_interest_remaining: 8000,
      total_amount_remaining: 26000,
      payments_remaining: 40,
      monthly_payment: 450,
    };

    it('should return payoff projection', async () => {
      service.getPayoffProjection.mockResolvedValue(mockProjection);

      const result = await controller.getPayoffProjection(mockLoanId, mockHouseholdId);

      expect(service.getPayoffProjection).toHaveBeenCalledWith(mockLoanId, mockHouseholdId);
      expect(result).toEqual(mockProjection);
    });

    it('should handle NotFoundException for loan', async () => {
      service.getPayoffProjection.mockRejectedValue(new NotFoundException('Loan not found'));

      await expect(controller.getPayoffProjection('nonexistent-id', mockHouseholdId)).rejects.toThrow(NotFoundException);
    });

    it('should handle BadRequestException for invalid calculation', async () => {
      service.getPayoffProjection.mockRejectedValue(new BadRequestException('Cannot calculate projection'));

      await expect(controller.getPayoffProjection(mockLoanId, mockHouseholdId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('createPayment', () => {
    const createPaymentDto: CreateLoanPaymentDto = {
      loan_id: mockLoanId,
      amount: 500,
      payment_date: '2023-12-01',
      type: PaymentType.REGULAR,
    };

    it('should create a payment successfully', async () => {
      service.createPayment.mockResolvedValue(mockLoanPayment as LoanPayment);

      const result = await controller.createPayment(mockLoanId, createPaymentDto, mockUserId, mockHouseholdId);

      expect(createPaymentDto.loan_id).toBe(mockLoanId); // Should be set by controller
      expect(service.createPayment).toHaveBeenCalledWith(createPaymentDto, mockUserId, mockHouseholdId);
      expect(result).toEqual(mockLoanPayment);
    });

    it('should handle BadRequestException for invalid payment', async () => {
      service.createPayment.mockRejectedValue(new BadRequestException('Invalid payment data'));

      await expect(controller.createPayment(mockLoanId, createPaymentDto, mockUserId, mockHouseholdId)).rejects.toThrow(BadRequestException);
    });

    it('should handle NotFoundException for loan', async () => {
      service.createPayment.mockRejectedValue(new NotFoundException('Loan not found'));

      await expect(controller.createPayment('nonexistent-id', createPaymentDto, mockUserId, mockHouseholdId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findPayments', () => {
    const mockPaymentsResponse = {
      payments: [mockLoanPayment],
      total: 1,
    };

    it('should return paginated payments', async () => {
      service.findPayments.mockResolvedValue(mockPaymentsResponse as any);

      const result = await controller.findPayments(mockLoanId, mockHouseholdId, mockPagination);

      expect(service.findPayments).toHaveBeenCalledWith(mockLoanId, mockHouseholdId, mockPagination);
      expect(result).toEqual({
        payments: [mockLoanPayment],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should handle NotFoundException for loan', async () => {
      service.findPayments.mockRejectedValue(new NotFoundException('Loan not found'));

      await expect(controller.findPayments('nonexistent-id', mockHouseholdId, mockPagination)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPaymentSummary', () => {
    const mockPaymentSummary: LoanPaymentSummaryDto = {
      loan_id: mockLoanId,
      total_payments: 12,
      total_amount_paid: 5400,
      total_principal_paid: 4800,
      total_interest_paid: 600,
      total_fees_paid: 50,
      last_payment_date: '2023-12-01',
      last_payment_amount: 450,
      late_payments_count: 0,
      average_payment_amount: 450,
      monthly_breakdown: [
        {
          month: '2023-12',
          payment_count: 1,
          total_amount: 450,
          principal_amount: 400,
          interest_amount: 50,
          fee_amount: 0,
        },
      ],
    };

    it('should return payment summary', async () => {
      service.getPaymentSummary.mockResolvedValue(mockPaymentSummary);

      const result = await controller.getPaymentSummary(mockLoanId, mockHouseholdId);

      expect(service.getPaymentSummary).toHaveBeenCalledWith(mockLoanId, mockHouseholdId);
      expect(result).toEqual(mockPaymentSummary);
    });

    it('should handle NotFoundException for loan', async () => {
      service.getPaymentSummary.mockRejectedValue(new NotFoundException('Loan not found'));

      await expect(controller.getPaymentSummary('nonexistent-id', mockHouseholdId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePayment', () => {
    const updatePaymentDto: UpdateLoanPaymentDto = {
      amount: 525,
      payment_date: '2023-12-02',
    };

    it('should update a payment successfully', async () => {
      const updatedPayment = { ...mockLoanPayment, ...updatePaymentDto };
      service.updatePayment.mockResolvedValue(updatedPayment as LoanPayment);

      const result = await controller.updatePayment(mockLoanId, 'payment-123', updatePaymentDto, mockHouseholdId);

      expect(service.updatePayment).toHaveBeenCalledWith('payment-123', updatePaymentDto, mockHouseholdId);
      expect(result).toEqual(updatedPayment);
    });

    it('should handle NotFoundException for payment', async () => {
      service.updatePayment.mockRejectedValue(new NotFoundException('Payment not found'));

      await expect(controller.updatePayment(mockLoanId, 'nonexistent-id', updatePaymentDto, mockHouseholdId)).rejects.toThrow(NotFoundException);
    });

    it('should handle BadRequestException for invalid data', async () => {
      service.updatePayment.mockRejectedValue(new BadRequestException('Invalid payment data'));

      await expect(controller.updatePayment(mockLoanId, 'payment-123', updatePaymentDto, mockHouseholdId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('removePayment', () => {
    it('should remove a payment successfully', async () => {
      service.removePayment.mockResolvedValue();

      const result = await controller.removePayment(mockLoanId, 'payment-123', mockHouseholdId);

      expect(service.removePayment).toHaveBeenCalledWith('payment-123', mockHouseholdId);
      expect(result).toEqual({ message: 'Payment deleted successfully' });
    });

    it('should handle NotFoundException for payment', async () => {
      service.removePayment.mockRejectedValue(new NotFoundException('Payment not found'));

      await expect(controller.removePayment(mockLoanId, 'nonexistent-id', mockHouseholdId)).rejects.toThrow(NotFoundException);
    });

    it('should handle BadRequestException for completed payment', async () => {
      service.removePayment.mockRejectedValue(new BadRequestException('Cannot delete completed payment'));

      await expect(controller.removePayment(mockLoanId, 'payment-123', mockHouseholdId)).rejects.toThrow(BadRequestException);
    });
  });
});
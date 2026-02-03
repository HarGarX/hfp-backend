import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FindManyOptions } from 'typeorm';
import {
  Loan,
  LoanType,
  LoanStatus,
  PaymentFrequency,
} from '../entities/loan.entity';
import { LoanPayment, PaymentType, PaymentStatus } from '../entities/loan-payment.entity';
import {
  CreateLoanDto,
  UpdateLoanDto,
  LoanSummaryDto,
  PayoffProjectionDto,
  CreateLoanPaymentDto,
  UpdateLoanPaymentDto,
  LoanPaymentSummaryDto,
} from '../dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { LoanRepository } from '../repositories/loan.repository';
import { LoanPaymentRepository } from '../repositories/loan-payment.repository';

@Injectable()
export class LoansService {
  constructor(
    private readonly loanRepository: LoanRepository,
    private readonly loanPaymentRepository: LoanPaymentRepository,
  ) {}

  async create(
    createLoanDto: CreateLoanDto,
    userId: string,
    householdId: string,
  ): Promise<Loan> {
    // Set current balance to principal amount if not provided
    const currentBalance = createLoanDto.current_balance ?? createLoanDto.principal_amount;

    const loan = this.loanRepository.create({
      ...createLoanDto,
      current_balance: currentBalance,
      user_id: userId,
      household_id: householdId,
      payments_made: 0,
      total_fees_paid: 0,
      total_interest_paid: 0,
    });

    return await this.loanRepository.saveWithHousehold(householdId, loan);
  }

  async findAll(
    householdId: string,
    paginationDto: PaginationDto,
    filters?: {
      type?: LoanType;
      status?: LoanStatus;
      user_id?: string;
    },
  ): Promise<{ loans: Loan[]; total: number }> {
    const queryBuilder = this.loanRepository
      .createQueryBuilderWithHousehold(householdId, 'loan')
      .leftJoinAndSelect('loan.user', 'user')
      .leftJoinAndSelect('loan.account', 'account');

    if (filters?.type) {
      queryBuilder.andWhere('loan.type = :type', { type: filters.type });
    }

    if (filters?.status) {
      queryBuilder.andWhere('loan.status = :status', { status: filters.status });
    }

    if (filters?.user_id) {
      queryBuilder.andWhere('loan.user_id = :userId', { userId: filters.user_id });
    }

    queryBuilder
      .orderBy('loan.created_at', 'DESC')
      .skip((paginationDto.page! - 1) * paginationDto.limit!)
      .take(paginationDto.limit!);

    const [loans, total] = await queryBuilder.getManyAndCount();

    return { loans, total };
  }

  async findOne(id: string, householdId: string): Promise<Loan> {
    const loan = await this.loanRepository.findOneWithHousehold(
      householdId,
      {
        where: { id },
        relations: ['user', 'account'],
      },
    );

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    return loan;
  }

  async update(
    id: string,
    updateLoanDto: UpdateLoanDto,
    householdId: string,
  ): Promise<Loan> {
    const loan = await this.findOne(id, householdId);

    // Update loan properties
    Object.assign(loan, updateLoanDto);

    return await this.loanRepository.saveWithHousehold(householdId, loan);
  }

  async remove(id: string, householdId: string): Promise<void> {
    const loan = await this.findOne(id, householdId);
    await this.loanRepository.removeWithHousehold(householdId, loan);
  }

  async getSummary(householdId: string): Promise<LoanSummaryDto> {
    const loans = await this.loanRepository.findWithHousehold(householdId, {
      where: { status: LoanStatus.ACTIVE },
    });

    const totalLoans = loans.length;
    const totalDebt = loans.reduce((sum, loan) => sum + Number(loan.current_balance), 0);
    const monthlyPaymentTotal = loans.reduce(
      (sum, loan) => sum + loan.monthly_payment_equivalent,
      0,
    );
    const totalInterestPaid = loans.reduce(
      (sum, loan) => sum + Number(loan.total_interest_paid),
      0,
    );
    const totalFeesPaid = loans.reduce(
      (sum, loan) => sum + Number(loan.total_fees_paid),
      0,
    );
    const overdueLoansCount = loans.filter((loan) => loan.is_overdue).length;
    const averageInterestRate =
      totalLoans > 0
        ? loans.reduce((sum, loan) => sum + Number(loan.interest_rate), 0) / totalLoans
        : 0;

    // Breakdown by type
    const breakdownByType: Record<string, {
      count: number;
      total_balance: number;
      monthly_payment: number;
    }> = {};

    for (const loan of loans) {
      if (!breakdownByType[loan.type]) {
        breakdownByType[loan.type] = {
          count: 0,
          total_balance: 0,
          monthly_payment: 0,
        };
      }
      breakdownByType[loan.type].count++;
      breakdownByType[loan.type].total_balance += Number(loan.current_balance);
      breakdownByType[loan.type].monthly_payment += loan.monthly_payment_equivalent;
    }

    // Next payment information
    const loansWithPayments = loans.filter((loan) => loan.next_payment_date);
    const nextPaymentDate = loansWithPayments.length > 0
      ? loansWithPayments
          .map((loan) => new Date(loan.next_payment_date!))
          .sort((a, b) => a.getTime() - b.getTime())[0]
          .toISOString().split('T')[0]
      : undefined;

    const nextPaymentAmount = loansWithPayments
      .filter((loan) => 
        loan.next_payment_date === nextPaymentDate && loan.payment_amount
      )
      .reduce((sum, loan) => sum + Number(loan.payment_amount), 0);

    return {
      total_loans: totalLoans,
      total_debt: totalDebt,
      monthly_payment_total: monthlyPaymentTotal,
      total_interest_paid: totalInterestPaid,
      total_fees_paid: totalFeesPaid,
      overdue_loans_count: overdueLoansCount,
      average_interest_rate: averageInterestRate,
      breakdown_by_type: breakdownByType,
      next_payment_date: nextPaymentDate,
      next_payment_amount: nextPaymentAmount,
    };
  }

  async getPayoffProjection(id: string, householdId: string): Promise<PayoffProjectionDto> {
    const loan = await this.findOne(id, householdId);

    if (!loan.payment_amount || loan.current_balance <= 0) {
      throw new BadRequestException(
        'Cannot calculate payoff projection without payment amount or with zero balance',
      );
    }

    const currentBalance = Number(loan.current_balance);
    const monthlyPayment = loan.monthly_payment_equivalent;
    const monthlyInterestRate = Number(loan.interest_rate) / 12;

    let remainingBalance = currentBalance;
    let totalInterest = 0;
    let paymentsRemaining = 0;

    // Calculate payoff schedule
    while (remainingBalance > 0 && paymentsRemaining < 1000) { // Safety limit
      const interestPayment = remainingBalance * monthlyInterestRate;
      const principalPayment = Math.min(
        monthlyPayment - interestPayment,
        remainingBalance,
      );

      if (principalPayment <= 0) {
        // Payment doesn't cover interest
        throw new BadRequestException(
          'Payment amount is insufficient to cover interest',
        );
      }

      remainingBalance -= principalPayment;
      totalInterest += interestPayment;
      paymentsRemaining++;
    }

    const estimatedPayoffDate = new Date();
    estimatedPayoffDate.setMonth(estimatedPayoffDate.getMonth() + paymentsRemaining);

    return {
      loan_id: loan.id,
      current_balance: currentBalance,
      estimated_payoff_date: estimatedPayoffDate.toISOString().split('T')[0],
      total_interest_remaining: totalInterest,
      total_amount_remaining: currentBalance + totalInterest,
      payments_remaining: paymentsRemaining,
      monthly_payment: monthlyPayment,
    };
  }

  // Payment methods
  async createPayment(
    createPaymentDto: CreateLoanPaymentDto,
    userId: string,
    householdId: string,
  ): Promise<LoanPayment> {
    const loan = await this.findOne(createPaymentDto.loan_id, householdId);

    // Validate payment amount breakdown
    const totalBreakdown = 
      (createPaymentDto.principal_amount || 0) +
      (createPaymentDto.interest_amount || 0) +
      (createPaymentDto.fee_amount || 0);

    if (Math.abs(totalBreakdown - createPaymentDto.amount) > 0.01) {
      throw new BadRequestException(
        'Payment breakdown does not match total amount',
      );
    }

    const payment = this.loanPaymentRepository.create({
      ...createPaymentDto,
      user_id: userId,
      household_id: householdId,
    });

    const savedPayment = await this.loanPaymentRepository.saveWithHousehold(householdId, payment);

    // Update loan statistics if payment is completed
    if (savedPayment.status === PaymentStatus.COMPLETED) {
      await this.updateLoanAfterPayment(loan, savedPayment);
    }

    return savedPayment;
  }

  private async updateLoanAfterPayment(loan: Loan, payment: LoanPayment): Promise<void> {
    // Update loan balance and statistics
    loan.current_balance = Math.max(
      0,
      Number(loan.current_balance) - Number(payment.principal_amount || 0),
    );
    
    loan.payments_made += 1;
    loan.total_interest_paid = Number(loan.total_interest_paid) + Number(payment.interest_amount || 0);
    loan.total_fees_paid = Number(loan.total_fees_paid) + Number(payment.fee_amount || 0);
    loan.last_payment_date = payment.payment_date;

    // Update next payment date based on frequency
    if (loan.payment_frequency && loan.next_payment_date) {
      const nextDate = new Date(loan.next_payment_date);
      switch (loan.payment_frequency) {
        case PaymentFrequency.WEEKLY:
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case PaymentFrequency.BI_WEEKLY:
          nextDate.setDate(nextDate.getDate() + 14);
          break;
        case PaymentFrequency.MONTHLY:
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case PaymentFrequency.QUARTERLY:
          nextDate.setMonth(nextDate.getMonth() + 3);
          break;
        case PaymentFrequency.SEMI_ANNUALLY:
          nextDate.setMonth(nextDate.getMonth() + 6);
          break;
        case PaymentFrequency.ANNUALLY:
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
      }
      loan.next_payment_date = nextDate;
    }

    // Mark as paid off if balance is zero
    if (loan.current_balance === 0) {
      loan.status = LoanStatus.PAID_OFF;
      loan.next_payment_date = undefined;
    }

    await this.loanRepository.saveWithHousehold(loan.household_id, loan);
  }

  async findPayments(
    loanId: string,
    householdId: string,
    paginationDto: PaginationDto,
  ): Promise<{ payments: LoanPayment[]; total: number }> {
    // Verify loan exists and belongs to household
    await this.findOne(loanId, householdId);

    const skip = (paginationDto.page! - 1) * paginationDto.limit!;
    const queryBuilder = this.loanPaymentRepository
      .createQueryBuilderWithHousehold(householdId, 'payment')
      .leftJoinAndSelect('payment.user', 'user')
      .where('payment.loan_id = :loanId', { loanId })
      .orderBy('payment.payment_date', 'DESC')
      .skip(skip)
      .take(paginationDto.limit!);

    const [payments, total] = await queryBuilder.getManyAndCount();

    return { payments, total };
  }

  async findOnePayment(
    paymentId: string,
    householdId: string,
  ): Promise<LoanPayment> {
    const payment = await this.loanPaymentRepository.findOneWithHousehold(
      householdId,
      {
        where: { id: paymentId },
        relations: ['user', 'loan'],
      },
    );

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async updatePayment(
    paymentId: string,
    updatePaymentDto: UpdateLoanPaymentDto,
    householdId: string,
  ): Promise<LoanPayment> {
    const payment = await this.findOnePayment(paymentId, householdId);

    // If payment was already completed, don't allow status changes
    if (payment.status === PaymentStatus.COMPLETED && updatePaymentDto.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException(
        'Cannot change status of a completed payment',
      );
    }

    Object.assign(payment, updatePaymentDto);
    return await this.loanPaymentRepository.saveWithHousehold(householdId, payment);
  }

  async removePayment(paymentId: string, householdId: string): Promise<void> {
    const payment = await this.findOnePayment(paymentId, householdId);
    
    if (payment.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException(
        'Cannot delete a completed payment. Please contact support.',
      );
    }

    await this.loanPaymentRepository.removeWithHousehold(householdId, payment);
  }

  async getPaymentSummary(
    loanId: string,
    householdId: string,
  ): Promise<LoanPaymentSummaryDto> {
    // Verify loan exists
    await this.findOne(loanId, householdId);

    const payments = await this.loanPaymentRepository.findWithHousehold(householdId, {
      where: { 
        loan_id: loanId,
        status: PaymentStatus.COMPLETED,
      },
      order: { payment_date: 'ASC' },
    });

    const totalPayments = payments.length;
    const totalAmountPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalPrincipalPaid = payments.reduce((sum, p) => sum + Number(p.principal_amount || 0), 0);
    const totalInterestPaid = payments.reduce((sum, p) => sum + Number(p.interest_amount || 0), 0);
    const totalFeesPaid = payments.reduce((sum, p) => sum + Number(p.fee_amount || 0), 0);

    const lastPayment = payments[payments.length - 1];
    const latePaymentsCount = payments.filter(p => p.is_late).length;
    const averagePaymentAmount = totalPayments > 0 ? totalAmountPaid / totalPayments : 0;

    // Monthly breakdown
    const monthlyBreakdown: Array<{
      month: string;
      payment_count: number;
      total_amount: number;
      principal_amount: number;
      interest_amount: number;
      fee_amount: number;
    }> = [];

    const monthlyData: Record<string, any> = {};

    for (const payment of payments) {
      const monthKey = new Date(payment.payment_date).toISOString().substring(0, 7); // YYYY-MM
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          payment_count: 0,
          total_amount: 0,
          principal_amount: 0,
          interest_amount: 0,
          fee_amount: 0,
        };
      }

      monthlyData[monthKey].payment_count++;
      monthlyData[monthKey].total_amount += Number(payment.amount);
      monthlyData[monthKey].principal_amount += Number(payment.principal_amount || 0);
      monthlyData[monthKey].interest_amount += Number(payment.interest_amount || 0);
      monthlyData[monthKey].fee_amount += Number(payment.fee_amount || 0);
    }

    monthlyBreakdown.push(...Object.values(monthlyData));

    return {
      loan_id: loanId,
      total_payments: totalPayments,
      total_amount_paid: totalAmountPaid,
      total_principal_paid: totalPrincipalPaid,
      total_interest_paid: totalInterestPaid,
      total_fees_paid: totalFeesPaid,
      last_payment_date: lastPayment?.payment_date.toISOString().split('T')[0],
      last_payment_amount: lastPayment ? Number(lastPayment.amount) : undefined,
      late_payments_count: latePaymentsCount,
      average_payment_amount: averagePaymentAmount,
      monthly_breakdown: monthlyBreakdown,
    };
  }
}
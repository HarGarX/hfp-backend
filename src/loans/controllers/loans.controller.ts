import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { LoansService } from '../services/loans.service';
import {
  CreateLoanDto,
  UpdateLoanDto,
  LoanSummaryDto,
  PayoffProjectionDto,
  CreateLoanPaymentDto,
  UpdateLoanPaymentDto,
  LoanPaymentSummaryDto,
} from '../dto';
import { Loan, LoanType, LoanStatus } from '../entities/loan.entity';
import { LoanPayment } from '../entities/loan-payment.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextInterceptor } from '../../shared/interceptors/tenant-context.interceptor';
import { HouseholdGuard } from '../../shared/guards/household.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentHousehold } from '../../shared/decorators/current-household.decorator';
import { PaginationDto } from '../../shared/dto/pagination.dto';

@ApiTags('loans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HouseholdGuard)
@UseInterceptors(TenantContextInterceptor)
@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new loan' })
  @ApiBody({ type: CreateLoanDto })
  @ApiResponse({
    status: 201,
    description: 'Loan created successfully',
    type: Loan,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Body() createLoanDto: CreateLoanDto,
    @CurrentUser('sub') userId: string,
    @CurrentHousehold() householdId: string,
  ): Promise<Loan> {
    return await this.loansService.create(createLoanDto, userId, householdId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all loans for household' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page',
    example: 10,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: LoanType,
    description: 'Filter by loan type',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: LoanStatus,
    description: 'Filter by loan status',
  })
  @ApiQuery({
    name: 'user_id',
    required: false,
    type: String,
    description: 'Filter by user ID',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Loans retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        loans: {
          type: 'array',
          items: { $ref: '#/components/schemas/Loan' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(
    @CurrentHousehold() householdId: string,
    @Query() paginationDto: PaginationDto,
    @Query('type') type?: LoanType,
    @Query('status') status?: LoanStatus,
    @Query('user_id') userId?: string,
  ): Promise<{
    loans: Loan[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const filters = { type, status, user_id: userId };
    const { loans, total } = await this.loansService.findAll(
      householdId,
      paginationDto,
      filters,
    );

    return {
      loans,
      total,
      page: paginationDto.page!,
      limit: paginationDto.limit!,
      totalPages: Math.ceil(total / paginationDto.limit!),
    };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get loan portfolio summary for household' })
  @ApiResponse({
    status: 200,
    description: 'Loan summary retrieved successfully',
    type: LoanSummaryDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getSummary(
    @CurrentHousehold() householdId: string,
  ): Promise<LoanSummaryDto> {
    return await this.loansService.getSummary(householdId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get loan by ID' })
  @ApiParam({ name: 'id', description: 'Loan ID', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Loan retrieved successfully',
    type: Loan,
  })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentHousehold() householdId: string,
  ): Promise<Loan> {
    return await this.loansService.findOne(id, householdId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update loan by ID' })
  @ApiParam({ name: 'id', description: 'Loan ID', format: 'uuid' })
  @ApiBody({ type: UpdateLoanDto })
  @ApiResponse({
    status: 200,
    description: 'Loan updated successfully',
    type: Loan,
  })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLoanDto: UpdateLoanDto,
    @CurrentHousehold() householdId: string,
  ): Promise<Loan> {
    return await this.loansService.update(id, updateLoanDto, householdId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete loan by ID' })
  @ApiParam({ name: 'id', description: 'Loan ID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Loan deleted successfully' })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentHousehold() householdId: string,
  ): Promise<{ message: string }> {
    await this.loansService.remove(id, householdId);
    return { message: 'Loan deleted successfully' };
  }

  @Get(':id/payoff-projection')
  @ApiOperation({ summary: 'Get payoff projection for a loan' })
  @ApiParam({ name: 'id', description: 'Loan ID', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Payoff projection calculated successfully',
    type: PayoffProjectionDto,
  })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot calculate projection (missing payment amount or zero balance)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getPayoffProjection(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentHousehold() householdId: string,
  ): Promise<PayoffProjectionDto> {
    return await this.loansService.getPayoffProjection(id, householdId);
  }

  // Payment endpoints
  @Post(':id/payments')
  @ApiOperation({ summary: 'Create a payment for a loan' })
  @ApiParam({ name: 'id', description: 'Loan ID', format: 'uuid' })
  @ApiBody({ type: CreateLoanPaymentDto })
  @ApiResponse({
    status: 201,
    description: 'Payment created successfully',
    type: LoanPayment,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createPayment(
    @Param('id', ParseUUIDPipe) loanId: string,
    @Body() createPaymentDto: CreateLoanPaymentDto,
    @CurrentUser('sub') userId: string,
    @CurrentHousehold() householdId: string,
  ): Promise<LoanPayment> {
    // Ensure the loan_id in the DTO matches the URL parameter
    createPaymentDto.loan_id = loanId;
    return await this.loansService.createPayment(
      createPaymentDto,
      userId,
      householdId,
    );
  }

  @Get(':id/payments')
  @ApiOperation({ summary: 'Get all payments for a loan' })
  @ApiParam({ name: 'id', description: 'Loan ID', format: 'uuid' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Payments retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        payments: {
          type: 'array',
          items: { $ref: '#/components/schemas/LoanPayment' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findPayments(
    @Param('id', ParseUUIDPipe) loanId: string,
    @CurrentHousehold() householdId: string,
    @Query() paginationDto: PaginationDto,
  ): Promise<{
    payments: LoanPayment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { payments, total } = await this.loansService.findPayments(
      loanId,
      householdId,
      paginationDto,
    );

    return {
      payments,
      total,
      page: paginationDto.page!,
      limit: paginationDto.limit!,
      totalPages: Math.ceil(total / paginationDto.limit!),
    };
  }

  @Get(':id/payments/summary')
  @ApiOperation({ summary: 'Get payment summary for a loan' })
  @ApiParam({ name: 'id', description: 'Loan ID', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Payment summary retrieved successfully',
    type: LoanPaymentSummaryDto,
  })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getPaymentSummary(
    @Param('id', ParseUUIDPipe) loanId: string,
    @CurrentHousehold() householdId: string,
  ): Promise<LoanPaymentSummaryDto> {
    return await this.loansService.getPaymentSummary(loanId, householdId);
  }

  @Put(':loanId/payments/:paymentId')
  @ApiOperation({ summary: 'Update a loan payment' })
  @ApiParam({ name: 'loanId', description: 'Loan ID', format: 'uuid' })
  @ApiParam({ name: 'paymentId', description: 'Payment ID', format: 'uuid' })
  @ApiBody({ type: UpdateLoanPaymentDto })
  @ApiResponse({
    status: 200,
    description: 'Payment updated successfully',
    type: LoanPayment,
  })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updatePayment(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() updatePaymentDto: UpdateLoanPaymentDto,
    @CurrentHousehold() householdId: string,
  ): Promise<LoanPayment> {
    return await this.loansService.updatePayment(
      paymentId,
      updatePaymentDto,
      householdId,
    );
  }

  @Delete(':loanId/payments/:paymentId')
  @ApiOperation({ summary: 'Delete a loan payment' })
  @ApiParam({ name: 'loanId', description: 'Loan ID', format: 'uuid' })
  @ApiParam({ name: 'paymentId', description: 'Payment ID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Payment deleted successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete completed payment' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async removePayment(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @CurrentHousehold() householdId: string,
  ): Promise<{ message: string }> {
    await this.loansService.removePayment(paymentId, householdId);
    return { message: 'Payment deleted successfully' };
  }
}
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoansService } from './services/loans.service';
import { LoansController } from './controllers/loans.controller';
import { Loan } from './entities/loan.entity';
import { LoanPayment } from './entities/loan-payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Loan, LoanPayment])],
  controllers: [LoansController],
  providers: [LoansService],
  exports: [LoansService],
})
export class LoansModule {}

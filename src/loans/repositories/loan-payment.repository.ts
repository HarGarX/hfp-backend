import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from '../../../libs/tenant/repositories/base.repository';
import { LoanPayment } from '../entities/loan-payment.entity';

@Injectable()
export class LoanPaymentRepository extends BaseRepository<LoanPayment> {
  constructor(private dataSource: DataSource) {
    super(LoanPayment, dataSource.createEntityManager());
  }
}

import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from '../../../libs/tenant/repositories/base.repository';
import { Loan } from '../entities/loan.entity';

@Injectable()
export class LoanRepository extends BaseRepository<Loan> {
  constructor(private dataSource: DataSource) {
    super(Loan, dataSource.createEntityManager());
  }
}

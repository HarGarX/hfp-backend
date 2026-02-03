import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from '../../../libs/tenant/repositories/base.repository';
import { FinancialHealthScore } from '../entities/financial-health-score.entity';

@Injectable()
export class FinancialHealthScoreRepository extends BaseRepository<FinancialHealthScore> {
  constructor(private dataSource: DataSource) {
    super(FinancialHealthScore, dataSource.createEntityManager());
  }
}

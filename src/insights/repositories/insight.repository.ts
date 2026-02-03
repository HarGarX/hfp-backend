import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from '../../../libs/tenant/repositories/base.repository';
import { Insight } from '../entities/insight.entity';

@Injectable()
export class InsightRepository extends BaseRepository<Insight> {
  constructor(private dataSource: DataSource) {
    super(Insight, dataSource.createEntityManager());
  }
}

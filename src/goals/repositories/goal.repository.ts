import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from '../../../libs/tenant/repositories/base.repository';
import { Goal } from '../entities/goal.entity';

@Injectable()
export class GoalRepository extends BaseRepository<Goal> {
  constructor(private dataSource: DataSource) {
    super(Goal, dataSource.createEntityManager());
  }
}

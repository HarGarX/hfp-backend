import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from '../../../libs/tenant/repositories/base.repository';
import { GoalActivity } from '../entities/goal-activity.entity';

@Injectable()
export class GoalActivityRepository extends BaseRepository<GoalActivity> {
  constructor(private dataSource: DataSource) {
    super(GoalActivity, dataSource.createEntityManager());
  }
}

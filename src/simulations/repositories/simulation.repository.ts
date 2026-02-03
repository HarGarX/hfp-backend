import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseRepository } from '../../../libs/tenant/repositories/base.repository';
import { Simulation } from '../entities/simulation.entity';

@Injectable()
export class SimulationRepository extends BaseRepository<Simulation> {
  constructor(private dataSource: DataSource) {
    super(Simulation, dataSource.createEntityManager());
  }
}

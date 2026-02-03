import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { Simulation } from './simulation.entity';

@Entity('scenario_runs')
export class ScenarioRun extends BaseEntity {
  @Column({ type: 'uuid' })
  simulation_id: string;

  @ManyToOne(() => Simulation, simulation => simulation.scenario_runs)
  @JoinColumn({ name: 'simulation_id' })
  simulation: Simulation;

  @Column({ type: 'varchar', length: 255 })
  scenario_name: string;

  @Column({ type: 'jsonb' })
  parameters: Record<string, any>;

  @Column({ type: 'jsonb' })
  results: Record<string, any>;

  @Column({ type: 'integer', nullable: true })
  execution_time_ms?: number;
}

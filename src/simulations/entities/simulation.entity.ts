import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { HouseholdScopedEntity } from '../../shared/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { ScenarioRun } from './scenario-run.entity';

export enum SimulationType {
  GOAL = 'goal',
  DEBT_PAYOFF = 'debt_payoff',
  BUDGET = 'budget',
  RETIREMENT = 'retirement',
}

export enum SimulationStatus {
  DRAFT = 'draft',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('simulations')
export class Simulation extends HouseholdScopedEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: SimulationType })
  simulation_type: SimulationType;

  @Column({ type: 'jsonb' })
  base_scenario: Record<string, any>;

  @Column({ type: 'jsonb', default: [] })
  scenarios: Array<{
    name: string;
    description?: string;
    parameters: Record<string, any>;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  results?: Record<string, any>;

  @Column({ type: 'enum', enum: SimulationStatus, default: SimulationStatus.DRAFT })
  status: SimulationStatus;

  @Column({ type: 'uuid', nullable: true })
  created_by: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @OneToMany(() => ScenarioRun, scenarioRun => scenarioRun.simulation)
  scenario_runs: ScenarioRun[];
}

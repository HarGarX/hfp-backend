import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Simulation } from './entities/simulation.entity';
import { ScenarioRun } from './entities/scenario-run.entity';
import { SimulationsService } from './services/simulations.service';
import { ScenarioEngineService } from './services/scenario-engine.service';
import { SimulationsController } from './controllers/simulations.controller';
import { SimulationRepository } from './repositories/simulation.repository';
import { GoalsModule } from '../goals/goals.module';
import { LoansModule } from '../loans/loans.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Simulation, ScenarioRun]),
    GoalsModule,
    LoansModule,
  ],
  controllers: [SimulationsController],
  providers: [SimulationsService, ScenarioEngineService, SimulationRepository],
  exports: [SimulationsService],
})
export class SimulationsModule {}

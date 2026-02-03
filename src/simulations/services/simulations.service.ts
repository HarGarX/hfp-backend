import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Simulation, SimulationType, SimulationStatus } from '../entities/simulation.entity';
import { ScenarioRun } from '../entities/scenario-run.entity';
import { SimulationRepository } from '../repositories/simulation.repository';
import { ScenarioEngineService } from './scenario-engine.service';
import {
  CreateSimulationDto,
  UpdateSimulationDto,
  RunSimulationDto,
  AddScenarioDto,
  GoalSimulationDto,
  DebtPayoffSimulationDto,
  BudgetSimulationDto,
  RetirementSimulationDto,
} from '../dto';

@Injectable()
export class SimulationsService {
  private readonly logger = new Logger(SimulationsService.name);

  constructor(
    private readonly simulationRepository: SimulationRepository,
    @InjectRepository(ScenarioRun)
    private readonly scenarioRunRepository: Repository<ScenarioRun>,
    private readonly scenarioEngine: ScenarioEngineService,
  ) {}

  async create(
    createSimulationDto: CreateSimulationDto,
    householdId: string,
    userId: string,
  ): Promise<Simulation> {
    const simulation = this.simulationRepository.create({
      ...createSimulationDto,
      household_id: householdId,
      created_by: userId,
      status: SimulationStatus.DRAFT,
      scenarios: createSimulationDto.scenarios || [],
    });

    return this.simulationRepository.saveWithHousehold(householdId, simulation);
  }

  async findAll(householdId: string, page = 1, limit = 20): Promise<{
    simulations: Simulation[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const result = await this.simulationRepository.findWithPagination(householdId, {
      page,
      limit,
      order: { created_at: 'DESC' },
      relations: ['creator'],
    });

    return {
      simulations: result.data,
      total: result.total,
      page: result.page,
      totalPages: Math.ceil(result.total / result.limit),
    };
  }

  async findOne(id: string, householdId: string): Promise<Simulation> {
    const simulation = await this.simulationRepository.findOneWithHousehold(householdId, {
      where: { id },
      relations: ['creator', 'scenario_runs'],
    });

    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    return simulation;
  }

  async update(
    id: string,
    householdId: string,
    updateSimulationDto: UpdateSimulationDto,
  ): Promise<Simulation> {
    const simulation = await this.findOne(id, householdId);

    Object.assign(simulation, updateSimulationDto);

    return this.simulationRepository.saveWithHousehold(householdId, simulation);
  }

  async remove(id: string, householdId: string): Promise<void> {
    await this.findOne(id, householdId);
    await this.simulationRepository.softDelete(id);
  }

  async addScenario(
    id: string,
    householdId: string,
    addScenarioDto: AddScenarioDto,
  ): Promise<Simulation> {
    const simulation = await this.findOne(id, householdId);

    if (!simulation.scenarios) {
      simulation.scenarios = [];
    }

    simulation.scenarios.push({
      name: addScenarioDto.name,
      description: addScenarioDto.description,
      parameters: addScenarioDto.parameters,
    });

    return this.simulationRepository.saveWithHousehold(householdId, simulation);
  }

  async runSimulation(
    id: string,
    householdId: string,
    runDto?: RunSimulationDto,
  ): Promise<{ simulation: Simulation; results: any[] }> {
    const simulation = await this.findOne(id, householdId);

    simulation.status = SimulationStatus.RUNNING;
    await this.simulationRepository.saveWithHousehold(householdId, simulation);

    const results = [];

    try {
      // Run base scenario
      const baseResult = await this.executeScenario(
        simulation.simulation_type,
        householdId,
        simulation.base_scenario,
      );

      const baseRun = this.scenarioRunRepository.create({
        simulation_id: simulation.id,
        scenario_name: 'Base Scenario',
        parameters: simulation.base_scenario,
        results: baseResult,
        execution_time_ms: 0,
      });
      await this.scenarioRunRepository.save(baseRun);
      
      const results: Array<{ scenario: string; success: boolean; data?: any; error?: string; execution_time_ms?: number }> = [];
      results.push({ scenario: 'Base Scenario', ...baseResult });

      // Run additional scenarios if requested
      const scenariosToRun = runDto?.scenario_names && runDto.scenario_names.length > 0
        ? simulation.scenarios.filter(s => runDto.scenario_names!.includes(s.name))
        : simulation.scenarios;

      for (const scenario of scenariosToRun) {
        const startTime = Date.now();
        const result = await this.executeScenario(
          simulation.simulation_type,
          householdId,
          scenario.parameters,
        );
        const executionTime = Date.now() - startTime;

        const scenarioRun = this.scenarioRunRepository.create({
          simulation_id: simulation.id,
          scenario_name: scenario.name,
          parameters: scenario.parameters,
          results: result,
          execution_time_ms: executionTime,
        });
        await this.scenarioRunRepository.save(scenarioRun);
        results.push({ scenario: scenario.name, ...result });
      }

      simulation.status = SimulationStatus.COMPLETED;
      simulation.results = { runs: results, completed_at: new Date() };
    } catch (error) {
      simulation.status = SimulationStatus.FAILED;
      this.logger.error(`Simulation ${id} failed:`, error);
      throw error;
    } finally {
      await this.simulationRepository.saveWithHousehold(householdId, simulation);
    }

    return { simulation, results };
  }

  private async executeScenario(
    type: SimulationType,
    householdId: string,
    parameters: Record<string, any>,
  ): Promise<any> {
    switch (type) {
      case SimulationType.GOAL:
        return this.scenarioEngine.executeGoalSimulation(householdId, parameters as GoalSimulationDto);

      case SimulationType.DEBT_PAYOFF:
        return this.scenarioEngine.executeDebtPayoffSimulation(
          householdId,
          parameters as DebtPayoffSimulationDto,
        );

      case SimulationType.BUDGET:
        return this.scenarioEngine.executeBudgetSimulation(householdId, parameters as BudgetSimulationDto);

      case SimulationType.RETIREMENT:
        return this.scenarioEngine.executeRetirementSimulation(
          householdId,
          parameters as RetirementSimulationDto,
        );

      default:
        throw new BadRequestException(`Unknown simulation type: ${type}`);
    }
  }

  async getResults(id: string, householdId: string): Promise<any> {
    const simulation = await this.findOne(id, householdId);

    if (!simulation.results) {
      throw new BadRequestException('Simulation has not been run yet');
    }

    return simulation.results;
  }

  async compareScenarios(id: string, householdId: string): Promise<any> {
    const simulation = await this.findOne(id, householdId);

    const runs = await this.scenarioRunRepository.find({
      where: { simulation_id: id },
      order: { created_at: 'DESC' },
    });

    if (runs.length === 0) {
      throw new BadRequestException('No scenario runs found. Run the simulation first.');
    }

    // Extract key metrics for comparison
    const comparison = runs.map(run => ({
      scenario_name: run.scenario_name,
      parameters: run.parameters,
      key_metrics: this.extractKeyMetrics(simulation.simulation_type, run.results),
      execution_time_ms: run.execution_time_ms,
    }));

    return {
      simulation_type: simulation.simulation_type,
      scenarios: comparison,
      best_scenario: this.determineBestScenario(simulation.simulation_type, comparison),
    };
  }

  private extractKeyMetrics(type: SimulationType, results: any): Record<string, any> {
    if (!results.data) return {};

    switch (type) {
      case SimulationType.GOAL:
        return {
          years_to_goal: results.data.years_to_goal,
          total_contributions: results.data.total_contributions,
          total_interest: results.data.total_interest,
          goal_reached: results.data.goal_reached,
        };

      case SimulationType.DEBT_PAYOFF:
        return {
          years_to_payoff: results.data.years_to_payoff,
          total_interest_paid: results.data.total_interest_paid,
          all_paid_off: results.data.all_paid_off,
        };

      case SimulationType.BUDGET:
        return {
          monthly_impact: results.data.monthly_impact,
          annual_impact: results.data.annual_impact,
          total_savings: results.data.total_savings,
        };

      case SimulationType.RETIREMENT:
        return {
          retirement_balance: results.data.retirement_balance,
          sustainable_monthly_income: results.data.sustainable_monthly_income,
          total_growth: results.data.total_growth,
        };

      default:
        return {};
    }
  }

  private determineBestScenario(type: SimulationType, scenarios: any[]): string {
    if (scenarios.length === 0) return 'N/A';

    switch (type) {
      case SimulationType.GOAL:
        // Best = shortest time to goal
        return scenarios.reduce((best, curr) =>
          curr.key_metrics.years_to_goal < best.key_metrics.years_to_goal ? curr : best,
        ).scenario_name;

      case SimulationType.DEBT_PAYOFF:
        // Best = least interest paid
        return scenarios.reduce((best, curr) =>
          curr.key_metrics.total_interest_paid < best.key_metrics.total_interest_paid ? curr : best,
        ).scenario_name;

      case SimulationType.BUDGET:
        // Best = highest savings
        return scenarios.reduce((best, curr) =>
          curr.key_metrics.total_savings > best.key_metrics.total_savings ? curr : best,
        ).scenario_name;

      case SimulationType.RETIREMENT:
        // Best = highest retirement balance
        return scenarios.reduce((best, curr) =>
          curr.key_metrics.retirement_balance > best.key_metrics.retirement_balance ? curr : best,
        ).scenario_name;

      default:
        return scenarios[0]?.scenario_name || 'N/A';
    }
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { HouseholdGuard } from '../../shared/guards/household.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentHousehold } from '../../shared/decorators/current-household.decorator';
import { SimulationsService } from '../services/simulations.service';
import {
  CreateSimulationDto,
  UpdateSimulationDto,
  RunSimulationDto,
  AddScenarioDto,
} from '../dto';

@ApiTags('Simulations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HouseholdGuard)
@Controller('simulations')
export class SimulationsController {
  constructor(private readonly simulationsService: SimulationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new simulation' })
  @ApiResponse({ status: 201, description: 'Simulation created successfully' })
  create(
    @Body() createSimulationDto: CreateSimulationDto,
    @CurrentHousehold() householdId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.simulationsService.create(createSimulationDto, householdId, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all simulations for household' })
  @ApiResponse({ status: 200, description: 'Simulations retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @CurrentHousehold() householdId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.simulationsService.findAll(householdId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get simulation by ID' })
  @ApiResponse({ status: 200, description: 'Simulation retrieved successfully' })
  findOne(@Param('id') id: string, @CurrentHousehold() householdId: string) {
    return this.simulationsService.findOne(id, householdId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update simulation' })
  @ApiResponse({ status: 200, description: 'Simulation updated successfully' })
  update(
    @Param('id') id: string,
    @CurrentHousehold() householdId: string,
    @Body() updateSimulationDto: UpdateSimulationDto,
  ) {
    return this.simulationsService.update(id, householdId, updateSimulationDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete simulation' })
  @ApiResponse({ status: 200, description: 'Simulation deleted successfully' })
  async remove(@Param('id') id: string, @CurrentHousehold() householdId: string) {
    await this.simulationsService.remove(id, householdId);
    return { message: 'Simulation deleted successfully' };
  }

  @Post(':id/scenarios')
  @ApiOperation({ summary: 'Add scenario to simulation' })
  @ApiResponse({ status: 201, description: 'Scenario added successfully' })
  addScenario(
    @Param('id') id: string,
    @CurrentHousehold() householdId: string,
    @Body() addScenarioDto: AddScenarioDto,
  ) {
    return this.simulationsService.addScenario(id, householdId, addScenarioDto);
  }

  @Post(':id/run')
  @ApiOperation({ summary: 'Run simulation and all scenarios' })
  @ApiResponse({ status: 200, description: 'Simulation executed successfully' })
  runSimulation(
    @Param('id') id: string,
    @CurrentHousehold() householdId: string,
    @Body() runDto?: RunSimulationDto,
  ) {
    return this.simulationsService.runSimulation(id, householdId, runDto);
  }

  @Get(':id/results')
  @ApiOperation({ summary: 'Get simulation results' })
  @ApiResponse({ status: 200, description: 'Results retrieved successfully' })
  getResults(@Param('id') id: string, @CurrentHousehold() householdId: string) {
    return this.simulationsService.getResults(id, householdId);
  }

  @Get(':id/compare')
  @ApiOperation({ summary: 'Compare all scenarios in simulation' })
  @ApiResponse({ status: 200, description: 'Scenario comparison retrieved successfully' })
  compareScenarios(@Param('id') id: string, @CurrentHousehold() householdId: string) {
    return this.simulationsService.compareScenarios(id, householdId);
  }
}

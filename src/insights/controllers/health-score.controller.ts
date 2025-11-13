import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Request,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { FinancialHealthScoreService } from '../services/financial-health-score.service';
import {
  GenerateHealthScoreDto,
  HealthScoreDto,
  HealthScoreHistoryDto,
} from '../dto';
import { KeycloakAuthGuard } from '../../auth/guards/keycloak-auth.guard';
import { HouseholdGuard } from '../../shared/guards/household.guard';

@ApiTags('health-score')
@Controller('health-score')
@UseGuards(KeycloakAuthGuard, HouseholdGuard)
@ApiBearerAuth()
export class HealthScoreController {
  constructor(
    private readonly healthScoreService: FinancialHealthScoreService,
  ) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Generate financial health score',
    description: 'Calculate the current financial health score for the household or user',
  })
  @ApiResponse({
    status: 201,
    description: 'Financial health score calculated successfully',
    type: HealthScoreDto,
  })
  async generateHealthScore(
    @Body() generateDto: GenerateHealthScoreDto,
    @Request() req: any,
  ): Promise<HealthScoreDto> {
    return this.healthScoreService.generateHealthScore(
      req.user.householdId,
      req.user.userId,
      generateDto,
    );
  }

  @Get('current')
  @ApiOperation({
    summary: 'Get current health score',
    description: 'Retrieve the most recent financial health score',
  })
  @ApiQuery({ 
    name: 'user_id', 
    required: false, 
    description: 'Get score for specific user (defaults to current user)' 
  })
  @ApiResponse({
    status: 200,
    description: 'Current health score retrieved successfully',
    type: HealthScoreDto,
  })
  async getCurrentHealthScore(
    @Query('user_id') userId: string,
    @Request() req: any,
  ): Promise<HealthScoreDto> {
    return this.healthScoreService.generateHealthScore(
      req.user.householdId,
      userId || req.user.userId,
      { force_recalculation: false },
    );
  }

  @Get('history')
  @ApiOperation({
    summary: 'Get health score history',
    description: 'Retrieve historical health scores and trends',
  })
  @ApiQuery({ 
    name: 'user_id', 
    required: false, 
    description: 'Get history for specific user (defaults to current user)' 
  })
  @ApiResponse({
    status: 200,
    description: 'Health score history retrieved successfully',
    type: HealthScoreHistoryDto,
  })
  async getHealthScoreHistory(
    @Query('user_id') userId: string,
    @Request() req: any,
  ): Promise<HealthScoreHistoryDto> {
    return this.healthScoreService.getHealthScoreHistory(
      req.user.householdId,
      userId || req.user.userId,
    );
  }
}
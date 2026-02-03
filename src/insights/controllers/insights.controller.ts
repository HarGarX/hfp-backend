import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { InsightsService } from '../services/insights.service';
import {
  CreateInsightDto,
  UpdateInsightDto,
  InsightFiltersDto,
  InsightSummaryDto,
  AcknowledgeInsightDto,
} from '../dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { HouseholdGuard } from '../../shared/guards/household.guard';
import { Insight } from '../entities/insight.entity';

@ApiTags('insights')
@Controller('insights')
@UseGuards(JwtAuthGuard, HouseholdGuard)
@ApiBearerAuth()
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new insight',
    description: 'Create a custom insight for the household or specific user',
  })
  @ApiResponse({
    status: 201,
    description: 'Insight created successfully',
    type: Insight,
  })
  async create(
    @Body() createInsightDto: CreateInsightDto,
    @Request() req: any,
  ): Promise<Insight> {
    return this.insightsService.create(
      createInsightDto,
      req.user.userId,
      req.user.householdId,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get all insights',
    description: 'Retrieve all insights for the household with optional filtering',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiResponse({
    status: 200,
    description: 'List of insights retrieved successfully',
  })
  async findAll(
    @Query() paginationDto: PaginationDto,
    @Query() filters: InsightFiltersDto,
    @Request() req: any,
  ): Promise<{ insights: Insight[]; total: number }> {
    return this.insightsService.findAll(
      req.user.householdId,
      paginationDto,
      filters,
    );
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get insights summary',
    description: 'Get statistical summary of insights for the household',
  })
  @ApiResponse({
    status: 200,
    description: 'Insights summary retrieved successfully',
    type: InsightSummaryDto,
  })
  async getSummary(@Request() req: any): Promise<InsightSummaryDto> {
    return this.insightsService.getSummary(req.user.householdId);
  }

  @Post('generate/spending-patterns')
  @ApiOperation({
    summary: 'Generate spending pattern insights',
    description: 'Analyze spending patterns and generate actionable insights',
  })
  @ApiResponse({
    status: 201,
    description: 'Spending pattern insights generated successfully',
  })
  async generateSpendingPatterns(@Request() req: any): Promise<Insight[]> {
    return this.insightsService.generateSpendingPatternInsights(req.user.householdId);
  }

  @Post('generate/budget-recommendations')
  @ApiOperation({
    summary: 'Generate budget recommendations',
    description: 'Analyze financial data and generate personalized budget recommendations',
  })
  @ApiResponse({
    status: 201,
    description: 'Budget recommendations generated successfully',
  })
  async generateBudgetRecommendations(@Request() req: any): Promise<Insight> {
    return this.insightsService.generateBudgetRecommendations(req.user.householdId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get insight by ID',
    description: 'Retrieve a specific insight by its ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Insight retrieved successfully',
    type: Insight,
  })
  @ApiResponse({
    status: 404,
    description: 'Insight not found',
  })
  async findOne(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<Insight> {
    return this.insightsService.findOne(id, req.user.householdId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update insight',
    description: 'Update insight status, rating, or feedback',
  })
  @ApiResponse({
    status: 200,
    description: 'Insight updated successfully',
    type: Insight,
  })
  @ApiResponse({
    status: 404,
    description: 'Insight not found',
  })
  async update(
    @Param('id') id: string,
    @Body() updateInsightDto: UpdateInsightDto,
    @Request() req: any,
  ): Promise<Insight> {
    return this.insightsService.update(id, updateInsightDto, req.user.householdId);
  }

  @Post(':id/acknowledge')
  @ApiOperation({
    summary: 'Acknowledge insight',
    description: 'Mark an insight as acknowledged by the user',
  })
  @ApiResponse({
    status: 200,
    description: 'Insight acknowledged successfully',
    type: Insight,
  })
  @ApiResponse({
    status: 404,
    description: 'Insight not found',
  })
  async acknowledge(
    @Param('id') id: string,
    @Body() acknowledgeDto: AcknowledgeInsightDto,
    @Request() req: any,
  ): Promise<Insight> {
    return this.insightsService.acknowledge(
      id,
      acknowledgeDto,
      req.user.userId,
      req.user.householdId,
    );
  }

  @Post(':id/dismiss')
  @ApiOperation({
    summary: 'Dismiss insight',
    description: 'Mark an insight as dismissed by the user',
  })
  @ApiResponse({
    status: 200,
    description: 'Insight dismissed successfully',
    type: Insight,
  })
  @ApiResponse({
    status: 404,
    description: 'Insight not found',
  })
  async dismiss(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<Insight> {
    return this.insightsService.dismiss(id, req.user.householdId);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete insight',
    description: 'Permanently delete an insight',
  })
  @ApiResponse({
    status: 200,
    description: 'Insight deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Insight not found',
  })
  async remove(@Param('id') id: string, @Request() req: any): Promise<void> {
    return this.insightsService.remove(id, req.user.householdId);
  }
}
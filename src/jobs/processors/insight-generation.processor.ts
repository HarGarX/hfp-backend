import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { InsightsService } from '../../insights/services/insights.service';
import { InsightType } from '../../insights/entities/insight.entity';

export interface InsightGenerationJobData {
  householdId: string;
  insightTypes?: InsightType[];
  periodStart?: Date;
  periodEnd?: Date;
}

@Processor('insight-generation')
export class InsightGenerationProcessor {
  private readonly logger = new Logger(InsightGenerationProcessor.name);

  constructor(
    private readonly insightsService: InsightsService,
  ) {}

  @Process('generate-insights')
  async handleInsightGeneration(job: Job<InsightGenerationJobData>) {
    this.logger.log(`Generating insights for household: ${job.data.householdId}`);
    
    try {
      const { householdId, insightTypes, periodStart, periodEnd } = job.data;

      // If no specific types provided, generate all types
      const typesToGenerate = insightTypes || [
        InsightType.SPENDING_PATTERN,
        InsightType.SAVINGS_OPPORTUNITY,
        InsightType.GOAL_PROGRESS,
        InsightType.ANOMALY_DETECTION,
      ];

      const generatedInsights: any[] = [];

      for (const type of typesToGenerate) {
        try {
          const insights = await this.generateInsightByType(
            householdId,
            type,
            periodStart,
            periodEnd
          );
          generatedInsights.push(...insights);
        } catch (error) {
          this.logger.error(
            `Failed to generate ${type} insights for household ${householdId}`,
            error.stack
          );
        }
      }

      this.logger.log(
        `Generated ${generatedInsights.length} insights for household ${householdId}`
      );

      return {
        success: true,
        insightsGenerated: generatedInsights.length,
        insights: generatedInsights,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate insights for household ${job.data.householdId}`,
        error.stack
      );
      throw error;
    }
  }

  private async generateInsightByType(
    householdId: string,
    type: InsightType,
    periodStart?: Date,
    periodEnd?: Date
  ): Promise<any[]> {
    switch (type) {
      case InsightType.SPENDING_PATTERN:
        return this.generateSpendingPatternInsights(householdId, periodStart, periodEnd);
      
      case InsightType.SAVINGS_OPPORTUNITY:
        return this.generateSavingOpportunityInsights(householdId);
      
      case InsightType.GOAL_PROGRESS:
        return this.generateGoalProgressInsights(householdId);
      
      case InsightType.ANOMALY_DETECTION:
        return this.generateAnomalyInsights(householdId, periodStart, periodEnd);
      
      default:
        return [];
    }
  }

  private async generateSpendingPatternInsights(
    householdId: string,
    periodStart?: Date,
    periodEnd?: Date
  ): Promise<any[]> {
    // Analyze spending patterns and generate insights
    // This would use InsightsService to analyze transaction data
    this.logger.debug(`Generating spending pattern insights for household ${householdId}`);
    
    // Placeholder - actual implementation would analyze transaction patterns
    return [];
  }

  private async generateBudgetAlertInsights(householdId: string): Promise<any[]> {
    // Check budget utilization and generate alerts
    this.logger.debug(`Generating budget alert insights for household ${householdId}`);
    
    // Placeholder - actual implementation would check budget vs actual spending
    return [];
  }

  private async generateSavingOpportunityInsights(householdId: string): Promise<any[]> {
    // Identify potential saving opportunities
    this.logger.debug(`Generating saving opportunity insights for household ${householdId}`);
    
    // Placeholder - actual implementation would identify recurring expenses that could be reduced
    return [];
  }

  private async generateGoalProgressInsights(householdId: string): Promise<any[]> {
    // Analyze goal progress and provide recommendations
    this.logger.debug(`Generating goal progress insights for household ${householdId}`);
    
    // Placeholder - actual implementation would analyze goal progress and project completion
    return [];
  }

  private async generateAnomalyInsights(
    householdId: string,
    periodStart?: Date,
    periodEnd?: Date
  ): Promise<any[]> {
    // Detect unusual spending patterns or anomalies
    this.logger.debug(`Generating anomaly insights for household ${householdId}`);
    
    // Placeholder - actual implementation would use statistical analysis to detect anomalies
    return [];
  }

  @Process('batch-generate')
  async handleBatchGeneration(job: Job<{ householdIds: string[] }>) {
    this.logger.log(`Batch generating insights for ${job.data.householdIds.length} households`);
    
    try {
      const results: Array<{
        householdId: string;
        success: boolean;
        insightsGenerated?: number;
        error?: string;
      }> = [];
      
      for (const householdId of job.data.householdIds) {
        try {
          const result = await this.handleInsightGeneration({
            data: { householdId },
          } as Job<InsightGenerationJobData>);
          
          results.push({
            householdId,
            success: true,
            insightsGenerated: result.insightsGenerated,
          });
        } catch (error) {
          this.logger.error(`Failed to generate insights for household ${householdId}`, error.stack);
          results.push({
            householdId,
            success: false,
            error: error.message,
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const totalInsights = results.reduce((sum, r) => sum + (r.insightsGenerated || 0), 0);
      
      this.logger.log(
        `Batch insight generation completed: ${successCount}/${results.length} households, ${totalInsights} total insights`
      );

      return {
        success: true,
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: results.length - successCount,
          totalInsights,
        },
      };
    } catch (error) {
      this.logger.error('Batch insight generation failed', error.stack);
      throw error;
    }
  }
}

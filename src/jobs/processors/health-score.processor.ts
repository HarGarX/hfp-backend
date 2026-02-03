import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { FinancialHealthScoreService } from '../../insights/services/financial-health-score.service';

export interface HealthScoreJobData {
  householdId: string;
  forceRecalculation?: boolean;
}

@Processor('health-score')
export class HealthScoreProcessor {
  private readonly logger = new Logger(HealthScoreProcessor.name);

  constructor(
    private readonly healthScoreService: FinancialHealthScoreService,
  ) {}

  @Process('calculate-score')
  async handleScoreCalculation(job: Job<HealthScoreJobData>) {
    this.logger.log(`Calculating health score for household: ${job.data.householdId}`);
    
    try {
      const { householdId, forceRecalculation } = job.data;

      // Calculate the financial health score
      const healthScore = await this.healthScoreService.generateHealthScore(
        householdId,
        undefined,
        { force_recalculation: forceRecalculation }
      );

      this.logger.log(
        `Health score calculated successfully for household ${householdId}: ${healthScore.overall_score}/100`
      );

      return {
        success: true,
        healthScore,
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate health score for household ${job.data.householdId}`,
        error.stack
      );
      throw error;
    }
  }

  @Process('batch-calculate')
  async handleBatchCalculation(job: Job<{ householdIds: string[] }>) {
    this.logger.log(`Batch calculating health scores for ${job.data.householdIds.length} households`);
    
    try {
      const results: Array<{
        householdId: string;
        success: boolean;
        score?: number;
        error?: string;
      }> = [];
      
      for (const householdId of job.data.householdIds) {
        try {
          const healthScore = await this.healthScoreService.generateHealthScore(householdId);
          results.push({
            householdId,
            success: true,
            score: healthScore.overall_score,
          });
        } catch (error) {
          this.logger.error(`Failed to calculate score for household ${householdId}`, error.stack);
          results.push({
            householdId,
            success: false,
            error: error.message,
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      this.logger.log(`Batch calculation completed: ${successCount}/${results.length} successful`);

      return {
        success: true,
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: results.length - successCount,
        },
      };
    } catch (error) {
      this.logger.error('Batch health score calculation failed', error.stack);
      throw error;
    }
  }
}

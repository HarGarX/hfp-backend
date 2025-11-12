import { PartialType, OmitType } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateGoalDto } from './create-goal.dto';
import { GoalStatus } from '../entities/goal.entity';

export class UpdateGoalDto extends PartialType(
  OmitType(CreateGoalDto, ['goal_type'] as const)
) {
  @ApiPropertyOptional({
    description: 'Goal status',
    enum: GoalStatus,
    example: GoalStatus.PAUSED,
  })
  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;
}
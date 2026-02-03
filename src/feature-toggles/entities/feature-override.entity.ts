import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { FeatureFlag } from './feature-flag.entity';

@Entity('feature_overrides')
@Index(['featureFlagId', 'householdId'], { unique: true })
export class FeatureOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'feature_flag_id', type: 'uuid' })
  featureFlagId: string;

  @Column({ name: 'household_id', type: 'uuid' })
  householdId: string;

  @Column()
  enabled: boolean;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => FeatureFlag, (flag) => flag.overrides, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'feature_flag_id' })
  featureFlag: FeatureFlag;
}

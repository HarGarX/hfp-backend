import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { FeatureOverride } from './feature-override.entity';

@Entity('feature_flags')
export class FeatureFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  key: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: false })
  enabled: boolean;

  @Column({ name: 'rollout_percentage', type: 'integer', default: 0 })
  rolloutPercentage: number; // 0-100

  @Column({ name: 'target_households', type: 'jsonb', nullable: true })
  targetHouseholds: string[]; // Array of household IDs

  @Column({ name: 'target_roles', type: 'jsonb', nullable: true })
  targetRoles: string[]; // Array of roles

  @Column({ type: 'jsonb', nullable: true })
  conditions: Record<string, any>; // Complex targeting rules

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => FeatureOverride, (override) => override.featureFlag)
  overrides: FeatureOverride[];
}

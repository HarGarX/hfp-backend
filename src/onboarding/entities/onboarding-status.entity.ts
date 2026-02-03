import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { IsString, IsBoolean, IsObject, IsOptional, IsUUID } from 'class-validator';

@Entity('onboarding_status')
@Index(['user_id', 'step'])
export class OnboardingStatus {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @IsUUID()
  @Index()
  user_id: string;

  @Column('varchar', { length: 50 })
  @IsString()
  step: string;

  @Column('boolean', { default: false })
  @IsBoolean()
  completed: boolean;

  @Column('jsonb', { nullable: true })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
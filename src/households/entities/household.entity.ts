import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum HouseholdStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

@Entity('households')
export class Household extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: HouseholdStatus, default: HouseholdStatus.ACTIVE })
  status: HouseholdStatus;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  default_currency: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  timezone?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email?: string;

  @Column({ type: 'jsonb', nullable: true })
  preferences?: Record<string, any>;

  @Column({ type: 'int', default: 0 })
  member_count: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  total_income: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  total_expenses: number;

  // Relations
  @OneToMany(() => User, user => user.household)
  users: User[];
}
import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { HouseholdScopedEntity } from '../../shared/entities/base.entity';
import { Household } from '../../households/entities/household.entity';
import { User } from '../../users/entities/user.entity';

export enum AccountType {
  CHECKING = 'checking',
  SAVINGS = 'savings',
  CREDIT_CARD = 'credit_card',
  INVESTMENT = 'investment',
  CASH = 'cash',
  LOAN = 'loan',
  BUSINESS = 'business',
  OTHER = 'other',
}

export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CLOSED = 'closed',
  SUSPENDED = 'suspended',
}

@Entity('accounts')
export class Account extends HouseholdScopedEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: AccountType })
  account_type: AccountType;

  @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.ACTIVE })
  status: AccountStatus;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  current_balance: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  available_balance: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bank_name?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  account_number?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  routing_number?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  iban?: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  credit_limit?: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  interest_rate?: number;

  @Column({ type: 'date', nullable: true })
  opening_date?: Date;

  @Column({ type: 'date', nullable: true })
  closing_date?: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  is_external: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  external_id?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  external_provider?: string;

  @Column({ type: 'timestamp', nullable: true })
  last_synced_at?: Date;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'uuid', nullable: true })
  created_by?: string;

  // Relations
  @ManyToOne(() => Household)
  @JoinColumn({ name: 'household_id' })
  household: Household;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator?: User;
}
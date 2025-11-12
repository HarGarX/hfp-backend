import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { Household } from '../../households/entities/household.entity';
import { User } from '../../users/entities/user.entity';
import { HouseholdScopedEntity } from '../../shared/entities/base.entity';
import { Category } from './category.entity';

export enum TransactionType {
  EXPENSE = 'expense',
  INCOME = 'income',
  TRANSFER = 'transfer',
  REFUND = 'refund',
  ADJUSTMENT = 'adjustment',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RECONCILED = 'reconciled',
}

@Entity('transactions')
@Index(['household_id', 'date'])
@Index(['household_id', 'account_id', 'date'])
@Index(['household_id', 'category_id'])
@Index(['household_id', 'transaction_type', 'date'])
export class Transaction extends HouseholdScopedEntity {
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: TransactionType })
  transaction_type: TransactionType;

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.COMPLETED })
  status: TransactionStatus;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  merchant?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference_number?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  external_id?: string; // For bank import reconciliation

  @Column({ type: 'boolean', default: false })
  is_recurring: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  recurring_frequency?: string; // monthly, weekly, annually, etc.

  @Column({ type: 'date', nullable: true })
  recurring_end_date?: Date;

  @Column({ type: 'json', nullable: true })
  tags?: string[];

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  // Relationships
  @ManyToOne(() => Account, { nullable: false })
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({ type: 'uuid' })
  account_id: string;

  @ManyToOne(() => Account, { nullable: true })
  @JoinColumn({ name: 'transfer_account_id' })
  transfer_account?: Account;

  @Column({ type: 'uuid', nullable: true })
  transfer_account_id?: string;

  // Category relationship
  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category?: Category;

  @Column({ type: 'uuid', nullable: true })
  category_id?: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'created_by' })
  created_by_user: User;

  @Column({ type: 'uuid' })
  created_by: string;
}
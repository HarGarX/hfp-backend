import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { HouseholdScopedEntity } from '../../shared/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Account } from '../../accounts/entities/account.entity';

export enum LoanType {
  BNPL = 'bnpl',
  PERSONAL = 'personal',
  CREDIT_CARD = 'credit_card',
  MORTGAGE = 'mortgage',
  AUTO = 'auto',
  STUDENT = 'student',
  OTHER = 'other',
}

export enum LoanStatus {
  ACTIVE = 'active',
  PAID_OFF = 'paid_off',
  DEFAULTED = 'defaulted',
  DEFERRED = 'deferred',
  IN_GRACE_PERIOD = 'in_grace_period',
}

export enum PaymentFrequency {
  WEEKLY = 'weekly',
  BI_WEEKLY = 'bi_weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEMI_ANNUALLY = 'semi_annually',
  ANNUALLY = 'annually',
}

@Entity('loans')
export class Loan extends HouseholdScopedEntity {
  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: LoanType,
    default: LoanType.PERSONAL,
  })
  type: LoanType;

  @Column({
    type: 'enum',
    enum: LoanStatus,
    default: LoanStatus.ACTIVE,
  })
  status: LoanStatus;

  @Column('uuid')
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column('uuid', { nullable: true })
  account_id?: string;

  @ManyToOne(() => Account, { nullable: true })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  // Financial details
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  principal_amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  current_balance: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  interest_rate: number;

  @Column({
    type: 'enum',
    enum: PaymentFrequency,
    default: PaymentFrequency.MONTHLY,
  })
  payment_frequency: PaymentFrequency;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  payment_amount?: number;

  // Dates
  @Column({ type: 'date' })
  start_date: Date;

  @Column({ type: 'date', nullable: true })
  maturity_date?: Date;

  @Column({ type: 'date', nullable: true })
  next_payment_date?: Date;

  @Column({ type: 'date', nullable: true })
  last_payment_date?: Date;

  // BNPL specific fields
  @Column({ type: 'varchar', length: 100, nullable: true })
  bnpl_provider?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  merchant?: string;

  @Column({ type: 'int', nullable: true })
  installment_count?: number;

  @Column({ type: 'int', default: 0 })
  payments_made: number;

  // Fees and penalties
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  late_fee_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total_fees_paid: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total_interest_paid: number;

  // Metadata
  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;

  // Payments relationship - defined in payment entity to avoid circular import

  // Computed properties
  get remaining_balance(): number {
    return Number(this.current_balance) || 0;
  }

  get total_paid(): number {
    return Number(this.principal_amount) - Number(this.current_balance);
  }

  get payment_progress(): number {
    if (!this.principal_amount) return 0;
    return (this.total_paid / Number(this.principal_amount)) * 100;
  }

  get is_overdue(): boolean {
    if (!this.next_payment_date || this.status !== LoanStatus.ACTIVE) {
      return false;
    }
    return new Date() > new Date(this.next_payment_date);
  }

  get days_until_payment(): number | null {
    if (!this.next_payment_date || this.status !== LoanStatus.ACTIVE) {
      return null;
    }
    const today = new Date();
    const paymentDate = new Date(this.next_payment_date);
    const diffTime = paymentDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  get estimated_payoff_date(): Date | null {
    if (!this.payment_amount || this.current_balance <= 0) {
      return null;
    }

    const monthsRemaining = Math.ceil(
      Number(this.current_balance) / Number(this.payment_amount),
    );

    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + monthsRemaining);
    return payoffDate;
  }

  get monthly_payment_equivalent(): number {
    if (!this.payment_amount) return 0;

    const amount = Number(this.payment_amount);
    switch (this.payment_frequency) {
      case PaymentFrequency.WEEKLY:
        return amount * 4.33; // Average weeks per month
      case PaymentFrequency.BI_WEEKLY:
        return amount * 2.17; // Average bi-weeks per month
      case PaymentFrequency.MONTHLY:
        return amount;
      case PaymentFrequency.QUARTERLY:
        return amount / 3;
      case PaymentFrequency.SEMI_ANNUALLY:
        return amount / 6;
      case PaymentFrequency.ANNUALLY:
        return amount / 12;
      default:
        return amount;
    }
  }
}
import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { HouseholdScopedEntity } from '../../shared/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum PaymentType {
  REGULAR = 'regular',
  EXTRA = 'extra',
  LATE_FEE = 'late_fee',
  PENALTY = 'penalty',
  REFINANCE = 'refinance',
  PAYOFF = 'payoff',
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  BANK_TRANSFER = 'bank_transfer',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  ACH = 'ach',
  CHECK = 'check',
  CASH = 'cash',
  AUTO_PAY = 'auto_pay',
  OTHER = 'other',
}

@Entity('loan_payments')
export class LoanPayment extends HouseholdScopedEntity {
  @Column('uuid')
  loan_id: string;

  @ManyToOne('Loan', 'payments', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'loan_id' })
  loan: any;

  @Column('uuid')
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  principal_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  interest_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  fee_amount: number;

  @Column({
    type: 'enum',
    enum: PaymentType,
    default: PaymentType.REGULAR,
  })
  type: PaymentType;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    nullable: true,
  })
  payment_method?: PaymentMethod;

  @Column({ type: 'date' })
  payment_date: Date;

  @Column({ type: 'date', nullable: true })
  due_date?: Date;

  @Column({ type: 'varchar', length: 200, nullable: true })
  reference_number?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  // Balance after this payment
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  balance_after?: number;

  // Metadata for external payment providers
  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;

  // Computed properties
  get is_late(): boolean {
    if (!this.due_date) return false;
    return new Date(this.payment_date) > new Date(this.due_date);
  }

  get days_late(): number {
    if (!this.is_late || !this.due_date) return 0;
    const paymentDate = new Date(this.payment_date);
    const dueDate = new Date(this.due_date);
    const diffTime = paymentDate.getTime() - dueDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  get is_completed(): boolean {
    return this.status === PaymentStatus.COMPLETED;
  }

  get total_amount(): number {
    return (
      Number(this.principal_amount) +
      Number(this.interest_amount) +
      Number(this.fee_amount)
    );
  }
}
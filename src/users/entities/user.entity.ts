import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { HouseholdScopedEntity } from '../../shared/entities/base.entity';
import { Household } from '../../households/entities/household.entity';

export enum UserRole {
  ADMIN = 'admin',
  HOUSEHOLD_ADMIN = 'household_admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

@Entity('users')
export class User extends HouseholdScopedEntity {
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  first_name: string;

  @Column({ type: 'varchar', length: 255 })
  last_name: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password_hash: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.MEMBER,
  })
  role: UserRole;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @ManyToOne(() => Household)
  @JoinColumn({ name: 'household_id' })
  household: Household;
}
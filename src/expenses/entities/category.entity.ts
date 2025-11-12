import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { HouseholdScopedEntity } from '../../shared/entities/base.entity';

export enum CategoryType {
  EXPENSE = 'expense',
  INCOME = 'income',
  TRANSFER = 'transfer',
}

@Entity('categories')
@Unique(['household_id', 'name'])
@Index(['household_id', 'category_type'])
@Index(['household_id', 'parent_id'])
export class Category extends HouseholdScopedEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: CategoryType })
  category_type: CategoryType;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color?: string; // Hex color code for UI

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon?: string; // Icon identifier

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'boolean', default: false })
  is_system: boolean; // System-defined categories

  @Column({ type: 'integer', default: 0 })
  sort_order: number;

  // Self-referencing for subcategories
  @ManyToOne(() => Category, category => category.subcategories, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: Category;

  @Column({ type: 'uuid', nullable: true })
  parent_id?: string;

  @OneToMany(() => Category, category => category.parent)
  subcategories: Category[];

  // Monthly budget limit
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  budget_limit?: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  budget_period?: string; // monthly, quarterly, annually

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'created_by' })
  created_by_user: User;

  @Column({ type: 'uuid' })
  created_by: string;
}
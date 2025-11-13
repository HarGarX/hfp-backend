import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateLoansTables1762871568238 implements MigrationInterface {
    name = 'CreateLoansTables1762871568238'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."loans_type_enum" AS ENUM('bnpl', 'personal', 'credit_card', 'mortgage', 'auto', 'student', 'other')`);
        await queryRunner.query(`CREATE TYPE "public"."loans_status_enum" AS ENUM('active', 'paid_off', 'defaulted', 'deferred', 'in_grace_period')`);
        await queryRunner.query(`CREATE TYPE "public"."loans_payment_frequency_enum" AS ENUM('weekly', 'bi_weekly', 'monthly', 'quarterly', 'semi_annually', 'annually')`);
        await queryRunner.query(`CREATE TABLE "loans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "household_id" uuid NOT NULL, "name" character varying(200) NOT NULL, "description" text, "type" "public"."loans_type_enum" NOT NULL DEFAULT 'personal', "status" "public"."loans_status_enum" NOT NULL DEFAULT 'active', "user_id" uuid NOT NULL, "account_id" uuid, "principal_amount" numeric(12,2) NOT NULL, "current_balance" numeric(12,2) NOT NULL DEFAULT '0', "interest_rate" numeric(5,4) NOT NULL DEFAULT '0', "payment_frequency" "public"."loans_payment_frequency_enum" NOT NULL DEFAULT 'monthly', "payment_amount" numeric(10,2), "start_date" date NOT NULL, "maturity_date" date, "next_payment_date" date, "last_payment_date" date, "bnpl_provider" character varying(100), "merchant" character varying(100), "installment_count" integer, "payments_made" integer NOT NULL DEFAULT '0', "late_fee_amount" numeric(10,2) NOT NULL DEFAULT '0', "total_fees_paid" numeric(10,2) NOT NULL DEFAULT '0', "total_interest_paid" numeric(10,2) NOT NULL DEFAULT '0', "metadata" jsonb, CONSTRAINT "PK_5c6942c1e13e4de135c5203ee61" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."loan_payments_type_enum" AS ENUM('regular', 'extra', 'late_fee', 'penalty', 'refinance', 'payoff')`);
        await queryRunner.query(`CREATE TYPE "public"."loan_payments_status_enum" AS ENUM('pending', 'completed', 'failed', 'cancelled', 'refunded')`);
        await queryRunner.query(`CREATE TYPE "public"."loan_payments_payment_method_enum" AS ENUM('bank_transfer', 'credit_card', 'debit_card', 'ach', 'check', 'cash', 'auto_pay', 'other')`);
        await queryRunner.query(`CREATE TABLE "loan_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "household_id" uuid NOT NULL, "loan_id" uuid NOT NULL, "user_id" uuid NOT NULL, "amount" numeric(10,2) NOT NULL, "principal_amount" numeric(10,2) NOT NULL DEFAULT '0', "interest_amount" numeric(10,2) NOT NULL DEFAULT '0', "fee_amount" numeric(10,2) NOT NULL DEFAULT '0', "type" "public"."loan_payments_type_enum" NOT NULL DEFAULT 'regular', "status" "public"."loan_payments_status_enum" NOT NULL DEFAULT 'pending', "payment_method" "public"."loan_payments_payment_method_enum", "payment_date" date NOT NULL, "due_date" date, "reference_number" character varying(200), "description" character varying(500), "notes" text, "balance_after" numeric(12,2), "metadata" jsonb, CONSTRAINT "PK_db75e38243b5f2cb9e728da4d0f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "loans" ADD CONSTRAINT "FK_d135791c39e46e13ca4c2725fbb" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "loans" ADD CONSTRAINT "FK_4ca248baa776dbc6864eb6747f5" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "loan_payments" ADD CONSTRAINT "FK_6584bab09ac53bd8d00d74a58cd" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "loan_payments" ADD CONSTRAINT "FK_d874b4bcbcd131dbf753ebdb85d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "loan_payments" DROP CONSTRAINT "FK_d874b4bcbcd131dbf753ebdb85d"`);
        await queryRunner.query(`ALTER TABLE "loan_payments" DROP CONSTRAINT "FK_6584bab09ac53bd8d00d74a58cd"`);
        await queryRunner.query(`ALTER TABLE "loans" DROP CONSTRAINT "FK_4ca248baa776dbc6864eb6747f5"`);
        await queryRunner.query(`ALTER TABLE "loans" DROP CONSTRAINT "FK_d135791c39e46e13ca4c2725fbb"`);
        await queryRunner.query(`DROP TABLE "loan_payments"`);
        await queryRunner.query(`DROP TYPE "public"."loan_payments_payment_method_enum"`);
        await queryRunner.query(`DROP TYPE "public"."loan_payments_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."loan_payments_type_enum"`);
        await queryRunner.query(`DROP TABLE "loans"`);
        await queryRunner.query(`DROP TYPE "public"."loans_payment_frequency_enum"`);
        await queryRunner.query(`DROP TYPE "public"."loans_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."loans_type_enum"`);
    }

}

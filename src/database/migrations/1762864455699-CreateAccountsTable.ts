import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAccountsTable1762864455699 implements MigrationInterface {
    name = 'CreateAccountsTable1762864455699'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."accounts_account_type_enum" AS ENUM('checking', 'savings', 'credit_card', 'investment', 'cash', 'loan', 'business', 'other')`);
        await queryRunner.query(`CREATE TYPE "public"."accounts_status_enum" AS ENUM('active', 'inactive', 'closed', 'suspended')`);
        await queryRunner.query(`CREATE TABLE "accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "household_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "description" character varying(500), "account_type" "public"."accounts_account_type_enum" NOT NULL, "status" "public"."accounts_status_enum" NOT NULL DEFAULT 'active', "current_balance" numeric(15,2) NOT NULL DEFAULT '0', "available_balance" numeric(15,2) NOT NULL DEFAULT '0', "currency" character varying(3) NOT NULL DEFAULT 'USD', "bank_name" character varying(255), "account_number" character varying(100), "routing_number" character varying(20), "iban" character varying(100), "credit_limit" numeric(15,2), "interest_rate" numeric(5,4), "opening_date" date, "closing_date" date, "metadata" jsonb, "is_external" boolean NOT NULL DEFAULT false, "external_id" character varying(255), "external_provider" character varying(100), "last_synced_at" TIMESTAMP, "is_active" boolean NOT NULL DEFAULT true, "created_by" uuid, CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD CONSTRAINT "FK_009452e33c579fccc63ab0c6f0e" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD CONSTRAINT "FK_6ce484b7743042752cdecc41c99" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT "FK_6ce484b7743042752cdecc41c99"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT "FK_009452e33c579fccc63ab0c6f0e"`);
        await queryRunner.query(`DROP TABLE "accounts"`);
        await queryRunner.query(`DROP TYPE "public"."accounts_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."accounts_account_type_enum"`);
    }

}

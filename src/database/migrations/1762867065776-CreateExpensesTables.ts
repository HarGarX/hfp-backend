import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateExpensesTables1762867065776 implements MigrationInterface {
    name = 'CreateExpensesTables1762867065776'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."categories_category_type_enum" AS ENUM('expense', 'income', 'transfer')`);
        await queryRunner.query(`CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "household_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "description" character varying(500), "category_type" "public"."categories_category_type_enum" NOT NULL, "color" character varying(7), "icon" character varying(50), "is_active" boolean NOT NULL DEFAULT true, "is_system" boolean NOT NULL DEFAULT false, "sort_order" integer NOT NULL DEFAULT '0', "parent_id" uuid, "budget_limit" numeric(15,2), "budget_period" character varying(20), "created_by" uuid NOT NULL, CONSTRAINT "UQ_230ce2add2010332403a55dfc0c" UNIQUE ("household_id", "name"), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9092ff66359e5ee9c4b73b16fd" ON "categories" ("household_id", "parent_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_410b46a88a3aad0ba4914111ec" ON "categories" ("household_id", "category_type") `);
        await queryRunner.query(`CREATE TYPE "public"."transactions_transaction_type_enum" AS ENUM('expense', 'income', 'transfer', 'refund', 'adjustment')`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_status_enum" AS ENUM('pending', 'completed', 'failed', 'cancelled', 'reconciled')`);
        await queryRunner.query(`CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "household_id" uuid NOT NULL, "amount" numeric(15,2) NOT NULL, "transaction_type" "public"."transactions_transaction_type_enum" NOT NULL, "status" "public"."transactions_status_enum" NOT NULL DEFAULT 'completed', "description" character varying(255) NOT NULL, "notes" text, "date" date NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'USD', "merchant" character varying(255), "reference_number" character varying(100), "external_id" character varying(100), "is_recurring" boolean NOT NULL DEFAULT false, "recurring_frequency" character varying(50), "recurring_end_date" date, "tags" json, "metadata" json, "account_id" uuid NOT NULL, "transfer_account_id" uuid, "category_id" uuid, "created_by" uuid NOT NULL, CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5c7cd6a334667e947528e4ae55" ON "transactions" ("household_id", "transaction_type", "date") `);
        await queryRunner.query(`CREATE INDEX "IDX_8339601f5e1e776d612acd4894" ON "transactions" ("household_id", "category_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_32127798442c15b0212cee1e72" ON "transactions" ("household_id", "account_id", "date") `);
        await queryRunner.query(`CREATE INDEX "IDX_ef6d142696861b7b1421c2d1ce" ON "transactions" ("household_id", "date") `);
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_88cea2dc9c31951d06437879b40" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_23ad9291e0e22cdf46ae7ec5461" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_49c0d6e8ba4bfb5582000d851f0" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_f3d86bd577b8745dfa81f99df65" FOREIGN KEY ("transfer_account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_c9e41213ca42d50132ed7ab2b0f" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_77e84561125adeccf287547f66e" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_77e84561125adeccf287547f66e"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_c9e41213ca42d50132ed7ab2b0f"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_f3d86bd577b8745dfa81f99df65"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_49c0d6e8ba4bfb5582000d851f0"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_23ad9291e0e22cdf46ae7ec5461"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_88cea2dc9c31951d06437879b40"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ef6d142696861b7b1421c2d1ce"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_32127798442c15b0212cee1e72"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8339601f5e1e776d612acd4894"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5c7cd6a334667e947528e4ae55"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_transaction_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_410b46a88a3aad0ba4914111ec"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9092ff66359e5ee9c4b73b16fd"`);
        await queryRunner.query(`DROP TABLE "categories"`);
        await queryRunner.query(`DROP TYPE "public"."categories_category_type_enum"`);
    }

}

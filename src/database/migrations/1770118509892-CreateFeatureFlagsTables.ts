import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFeatureFlagsTables1770118509892 implements MigrationInterface {
    name = 'CreateFeatureFlagsTables1770118509892'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."simulations_simulation_type_enum" AS ENUM('goal', 'debt_payoff', 'budget', 'retirement')`);
        await queryRunner.query(`CREATE TYPE "public"."simulations_status_enum" AS ENUM('draft', 'running', 'completed', 'failed')`);
        await queryRunner.query(`CREATE TABLE "simulations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "household_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "description" text, "simulation_type" "public"."simulations_simulation_type_enum" NOT NULL, "base_scenario" jsonb NOT NULL, "scenarios" jsonb NOT NULL DEFAULT '[]', "results" jsonb, "status" "public"."simulations_status_enum" NOT NULL DEFAULT 'draft', "created_by" uuid, CONSTRAINT "PK_c6d15083257a1c84ecd67423c30" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "scenario_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "simulation_id" uuid NOT NULL, "scenario_name" character varying(255) NOT NULL, "parameters" jsonb NOT NULL, "results" jsonb NOT NULL, "execution_time_ms" integer, CONSTRAINT "PK_03af9cdd1647e2633f854848c2c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "onboarding_status" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "step" character varying(50) NOT NULL, "completed" boolean NOT NULL DEFAULT false, "data" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7acdd37ea8d80e587163288ae8b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c0cf6efc6f60b9f1546a86ced0" ON "onboarding_status" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_c5b6dbc8b90607ae8d56eb9092" ON "onboarding_status" ("user_id", "step") `);
        await queryRunner.query(`CREATE TABLE "feature_flags" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" character varying(255) NOT NULL, "name" character varying(255) NOT NULL, "description" text, "enabled" boolean NOT NULL DEFAULT false, "rollout_percentage" integer NOT NULL DEFAULT '0', "target_households" jsonb, "target_roles" jsonb, "conditions" jsonb, "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_36d0344370584b4d6a953c53a69" UNIQUE ("key"), CONSTRAINT "PK_db657d344e9caacfc9d5cf8bbac" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "feature_overrides" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "feature_flag_id" uuid NOT NULL, "household_id" uuid NOT NULL, "enabled" boolean NOT NULL, "reason" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e9189c6ff53758cccee04aed045" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2b4ab4a425eb91a3aab4cfd89b" ON "feature_overrides" ("feature_flag_id", "household_id") `);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_97b5061278a40c1dead71c1b889"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "keycloak_id"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ALTER COLUMN "digest_time" SET DEFAULT '09:00'`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ALTER COLUMN "quiet_hours_start" SET DEFAULT '22:00'`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ALTER COLUMN "quiet_hours_end" SET DEFAULT '08:00'`);
        await queryRunner.query(`ALTER TABLE "simulations" ADD CONSTRAINT "FK_48259af8e432695c93b006ab52b" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "scenario_runs" ADD CONSTRAINT "FK_03a9fc75b0d1fae50a5709edd39" FOREIGN KEY ("simulation_id") REFERENCES "simulations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "feature_overrides" ADD CONSTRAINT "FK_1e1f04ca67b173834d955bb6e3c" FOREIGN KEY ("feature_flag_id") REFERENCES "feature_flags"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "feature_overrides" DROP CONSTRAINT "FK_1e1f04ca67b173834d955bb6e3c"`);
        await queryRunner.query(`ALTER TABLE "scenario_runs" DROP CONSTRAINT "FK_03a9fc75b0d1fae50a5709edd39"`);
        await queryRunner.query(`ALTER TABLE "simulations" DROP CONSTRAINT "FK_48259af8e432695c93b006ab52b"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ALTER COLUMN "quiet_hours_end" SET DEFAULT '08:00:00'`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ALTER COLUMN "quiet_hours_start" SET DEFAULT '22:00:00'`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ALTER COLUMN "digest_time" SET DEFAULT '09:00:00'`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" ADD "keycloak_id" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_97b5061278a40c1dead71c1b889" UNIQUE ("keycloak_id")`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2b4ab4a425eb91a3aab4cfd89b"`);
        await queryRunner.query(`DROP TABLE "feature_overrides"`);
        await queryRunner.query(`DROP TABLE "feature_flags"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c5b6dbc8b90607ae8d56eb9092"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c0cf6efc6f60b9f1546a86ced0"`);
        await queryRunner.query(`DROP TABLE "onboarding_status"`);
        await queryRunner.query(`DROP TABLE "scenario_runs"`);
        await queryRunner.query(`DROP TABLE "simulations"`);
        await queryRunner.query(`DROP TYPE "public"."simulations_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."simulations_simulation_type_enum"`);
    }

}

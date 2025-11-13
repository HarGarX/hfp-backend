import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateInsightsTables1762949519660 implements MigrationInterface {
    name = 'CreateInsightsTables1762949519660'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."insights_type_enum" AS ENUM('spending_pattern', 'budget_recommendation', 'savings_opportunity', 'debt_analysis', 'goal_progress', 'cash_flow_forecast', 'category_analysis', 'seasonal_trend', 'anomaly_detection', 'financial_health')`);
        await queryRunner.query(`CREATE TYPE "public"."insights_priority_enum" AS ENUM('low', 'medium', 'high', 'critical')`);
        await queryRunner.query(`CREATE TYPE "public"."insights_status_enum" AS ENUM('active', 'acknowledged', 'dismissed', 'expired')`);
        await queryRunner.query(`CREATE TABLE "insights" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "household_id" uuid NOT NULL, "type" "public"."insights_type_enum" NOT NULL, "title" character varying(200) NOT NULL, "description" text NOT NULL, "priority" "public"."insights_priority_enum" NOT NULL DEFAULT 'medium', "status" "public"."insights_status_enum" NOT NULL DEFAULT 'active', "user_id" uuid, "data" jsonb NOT NULL, "model_version" character varying(100), "acknowledged_at" TIMESTAMP, "acknowledged_by" uuid, "expires_at" TIMESTAMP, "view_count" integer NOT NULL DEFAULT '0', "last_viewed_at" TIMESTAMP, "is_actionable" boolean NOT NULL DEFAULT false, "action_url" text, "user_rating" integer, "user_feedback" text, CONSTRAINT "PK_8616ab29fa49b7942541b8c964a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f4b607c7015663cd74688af660" ON "insights" ("household_id", "priority", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_1b4204f2d27280efb8844aa97b" ON "insights" ("household_id", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_082ece9c82a6a1070d2d301a42" ON "insights" ("household_id", "type", "status") `);
        await queryRunner.query(`CREATE TABLE "financial_health_scores" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "household_id" uuid NOT NULL, "user_id" uuid, "overall_score" integer NOT NULL, "category_scores" jsonb NOT NULL, "metrics" jsonb NOT NULL, "benchmarks" jsonb NOT NULL, "model_version" character varying(100) NOT NULL, "calculated_at" TIMESTAMP NOT NULL, "next_calculation_at" TIMESTAMP, "previous_score_id" uuid, CONSTRAINT "PK_8972d5dd0e6998a7ff572e710d6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b235a428bb59eca30fa27e6c4f" ON "financial_health_scores" ("household_id", "overall_score") `);
        await queryRunner.query(`CREATE INDEX "IDX_a0ceca838087933ab9f5f18907" ON "financial_health_scores" ("household_id", "user_id", "created_at") `);
        await queryRunner.query(`ALTER TABLE "insights" ADD CONSTRAINT "FK_fa35bbb946c341de84030e1a7e5" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "financial_health_scores" ADD CONSTRAINT "FK_d492655a6b317d14ed1e050b9cd" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "financial_health_scores" DROP CONSTRAINT "FK_d492655a6b317d14ed1e050b9cd"`);
        await queryRunner.query(`ALTER TABLE "insights" DROP CONSTRAINT "FK_fa35bbb946c341de84030e1a7e5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a0ceca838087933ab9f5f18907"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b235a428bb59eca30fa27e6c4f"`);
        await queryRunner.query(`DROP TABLE "financial_health_scores"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_082ece9c82a6a1070d2d301a42"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1b4204f2d27280efb8844aa97b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f4b607c7015663cd74688af660"`);
        await queryRunner.query(`DROP TABLE "insights"`);
        await queryRunner.query(`DROP TYPE "public"."insights_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."insights_priority_enum"`);
        await queryRunner.query(`DROP TYPE "public"."insights_type_enum"`);
    }

}

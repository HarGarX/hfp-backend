import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateGoalsTables1762869291711 implements MigrationInterface {
    name = 'CreateGoalsTables1762869291711'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."goals_goal_type_enum" AS ENUM('savings', 'debt_payoff', 'emergency_fund', 'investment', 'purchase', 'vacation', 'custom')`);
        await queryRunner.query(`CREATE TYPE "public"."goals_status_enum" AS ENUM('active', 'paused', 'completed', 'cancelled', 'overdue')`);
        await queryRunner.query(`CREATE TYPE "public"."goals_priority_enum" AS ENUM('low', 'medium', 'high', 'critical')`);
        await queryRunner.query(`CREATE TYPE "public"."goals_auto_contribute_enum" AS ENUM('none', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly')`);
        await queryRunner.query(`CREATE TABLE "goals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "household_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "description" text, "goal_type" "public"."goals_goal_type_enum" NOT NULL DEFAULT 'custom', "status" "public"."goals_status_enum" NOT NULL DEFAULT 'active', "priority" "public"."goals_priority_enum" NOT NULL DEFAULT 'medium', "target_amount" numeric(12,2) NOT NULL, "current_amount" numeric(12,2) NOT NULL DEFAULT '0', "target_date" TIMESTAMP NOT NULL, "completed_at" TIMESTAMP, "auto_contribute" "public"."goals_auto_contribute_enum" NOT NULL DEFAULT 'none', "auto_contribute_amount" numeric(12,2), "next_contribution_date" TIMESTAMP, "account_id" uuid, "category_id" uuid, "created_by" uuid NOT NULL, "metadata" jsonb, "tags" text, "notes" text, CONSTRAINT "CHK_dfacbcbc09d60d0f455c916852" CHECK (target_date > created_at), CONSTRAINT "CHK_1845fd06e0d0a44054557660e1" CHECK (current_amount >= 0), CONSTRAINT "CHK_c684191b968cf22e7af5d8b1aa" CHECK (target_amount > 0), CONSTRAINT "PK_26e17b251afab35580dff769223" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f04c44ba1e0c65f62290be475b" ON "goals" ("household_id", "created_by") `);
        await queryRunner.query(`CREATE INDEX "IDX_d238bf3b37ea85c3f21dd363c3" ON "goals" ("household_id", "goal_type") `);
        await queryRunner.query(`CREATE INDEX "IDX_e57b4e21bee72b9d050c8a25c0" ON "goals" ("household_id", "target_date") `);
        await queryRunner.query(`CREATE INDEX "IDX_fcc5373ce4c1ae45315a8136e5" ON "goals" ("household_id", "status") `);
        await queryRunner.query(`CREATE TYPE "public"."goal_activities_activity_type_enum" AS ENUM('manual_contribution', 'auto_contribution', 'withdrawal', 'milestone_reached', 'target_updated', 'status_changed', 'note_added', 'goal_created', 'goal_completed', 'goal_cancelled')`);
        await queryRunner.query(`CREATE TABLE "goal_activities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "household_id" uuid NOT NULL, "goal_id" uuid NOT NULL, "activity_type" "public"."goal_activities_activity_type_enum" NOT NULL, "amount" numeric(12,2), "previous_value" numeric(12,2), "new_value" numeric(12,2), "description" text, "performed_by" uuid NOT NULL, "transaction_id" uuid, "metadata" jsonb, CONSTRAINT "CHK_cc650f5f927661427c3aeb164a" CHECK (amount >= 0 OR amount IS NULL), CONSTRAINT "PK_197894ca57507b4b6f0125889a0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_984a79f2cde31069c6e9326b1f" ON "goal_activities" ("created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_eb85b2a1dad6250c6852e4be0a" ON "goal_activities" ("household_id", "performed_by") `);
        await queryRunner.query(`CREATE INDEX "IDX_92c52130f89a185f6cc25aeca6" ON "goal_activities" ("household_id", "activity_type") `);
        await queryRunner.query(`CREATE INDEX "IDX_d104fde526879de3df9496da97" ON "goal_activities" ("household_id", "goal_id") `);
        await queryRunner.query(`ALTER TABLE "goals" ADD CONSTRAINT "FK_b2a8c58bb96b42df218689f762c" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "goals" ADD CONSTRAINT "FK_ef438d885c2e3bf42bb191af743" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "goals" ADD CONSTRAINT "FK_dc822f74ea0fd833028eff07048" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "goal_activities" ADD CONSTRAINT "FK_f2947e1b7a09a0274e80f770932" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "goal_activities" ADD CONSTRAINT "FK_2b98e2e08065095a8b9d0707604" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "goal_activities" ADD CONSTRAINT "FK_6f6bb1f98763f930a0eee5c943c" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "goal_activities" DROP CONSTRAINT "FK_6f6bb1f98763f930a0eee5c943c"`);
        await queryRunner.query(`ALTER TABLE "goal_activities" DROP CONSTRAINT "FK_2b98e2e08065095a8b9d0707604"`);
        await queryRunner.query(`ALTER TABLE "goal_activities" DROP CONSTRAINT "FK_f2947e1b7a09a0274e80f770932"`);
        await queryRunner.query(`ALTER TABLE "goals" DROP CONSTRAINT "FK_dc822f74ea0fd833028eff07048"`);
        await queryRunner.query(`ALTER TABLE "goals" DROP CONSTRAINT "FK_ef438d885c2e3bf42bb191af743"`);
        await queryRunner.query(`ALTER TABLE "goals" DROP CONSTRAINT "FK_b2a8c58bb96b42df218689f762c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d104fde526879de3df9496da97"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_92c52130f89a185f6cc25aeca6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_eb85b2a1dad6250c6852e4be0a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_984a79f2cde31069c6e9326b1f"`);
        await queryRunner.query(`DROP TABLE "goal_activities"`);
        await queryRunner.query(`DROP TYPE "public"."goal_activities_activity_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fcc5373ce4c1ae45315a8136e5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e57b4e21bee72b9d050c8a25c0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d238bf3b37ea85c3f21dd363c3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f04c44ba1e0c65f62290be475b"`);
        await queryRunner.query(`DROP TABLE "goals"`);
        await queryRunner.query(`DROP TYPE "public"."goals_auto_contribute_enum"`);
        await queryRunner.query(`DROP TYPE "public"."goals_priority_enum"`);
        await queryRunner.query(`DROP TYPE "public"."goals_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."goals_goal_type_enum"`);
    }

}

import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotificationsTables1762950822063 implements MigrationInterface {
    name = 'CreateNotificationsTables1762950822063'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('expense_alert', 'goal_milestone', 'loan_payment_due', 'budget_exceeded', 'savings_opportunity', 'account_sync_failed', 'insight_generated', 'financial_health_update', 'weekly_digest', 'monthly_report', 'custom_alert')`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_priority_enum" AS ENUM('low', 'medium', 'high', 'urgent')`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_channels_enum" AS ENUM('in_app', 'email', 'sms', 'push')`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_status_enum" AS ENUM('pending', 'sent', 'delivered', 'read', 'failed', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "household_id" uuid NOT NULL, "type" "public"."notifications_type_enum" NOT NULL, "title" character varying(200) NOT NULL, "message" text NOT NULL, "priority" "public"."notifications_priority_enum" NOT NULL DEFAULT 'medium', "user_id" uuid, "channels" "public"."notifications_channels_enum" array NOT NULL, "status" "public"."notifications_status_enum" NOT NULL DEFAULT 'pending', "scheduled_at" TIMESTAMP, "sent_at" TIMESTAMP, "delivered_at" TIMESTAMP, "read_at" TIMESTAMP, "metadata" jsonb, "action_url" text, "retry_count" integer NOT NULL DEFAULT '0', "retry_after" TIMESTAMP, "error_message" text, "clicked_at" TIMESTAMP, "clicked_url" text, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fb6aec00675f57da3646682d0b" ON "notifications" ("scheduled_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_549819324d7baf7fe9a6902872" ON "notifications" ("household_id", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_c04d27330bd5afcb45d5eb66b8" ON "notifications" ("household_id", "type", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_7507c8fa44f492099749a4c20e" ON "notifications" ("household_id", "user_id", "status") `);
        await queryRunner.query(`CREATE TYPE "public"."notification_templates_type_enum" AS ENUM('expense_alert', 'goal_milestone', 'loan_payment_due', 'budget_exceeded', 'savings_opportunity', 'account_sync_failed', 'insight_generated', 'financial_health_update', 'weekly_digest', 'monthly_report', 'custom_alert')`);
        await queryRunner.query(`CREATE TYPE "public"."notification_templates_channel_enum" AS ENUM('in_app', 'email', 'sms', 'push')`);
        await queryRunner.query(`CREATE TYPE "public"."notification_templates_status_enum" AS ENUM('active', 'draft', 'archived')`);
        await queryRunner.query(`CREATE TYPE "public"."notification_templates_default_priority_enum" AS ENUM('low', 'medium', 'high', 'urgent')`);
        await queryRunner.query(`CREATE TABLE "notification_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "household_id" uuid NOT NULL, "name" character varying(100) NOT NULL, "description" character varying(500), "type" "public"."notification_templates_type_enum" NOT NULL, "channel" "public"."notification_templates_channel_enum" NOT NULL, "status" "public"."notification_templates_status_enum" NOT NULL DEFAULT 'active', "subject_template" character varying(200) NOT NULL, "body_template" text NOT NULL, "html_template" text, "default_priority" "public"."notification_templates_default_priority_enum" NOT NULL DEFAULT 'medium', "template_variables" jsonb NOT NULL DEFAULT '{}', "styling" jsonb NOT NULL DEFAULT '{}', "locale" character varying(10) NOT NULL DEFAULT 'en', "translations" jsonb NOT NULL DEFAULT '{}', "usage_count" integer NOT NULL DEFAULT '0', "last_used_at" TIMESTAMP, "success_rate" integer NOT NULL DEFAULT '0', "version" character varying(50) NOT NULL DEFAULT '1.0.0', "parent_template_id" uuid, "is_system_template" boolean NOT NULL DEFAULT false, "is_customizable" boolean NOT NULL DEFAULT true, "validation_schema" text, CONSTRAINT "UQ_152c41c9d34014bb1c0bc2a2fbf" UNIQUE ("household_id", "type", "channel", "name"), CONSTRAINT "PK_76f0fc48b8d057d2ae7f3a2848a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8a1520dea132afb3f4a2a51040" ON "notification_templates" ("household_id", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_5965df3b146429159d6390c200" ON "notification_templates" ("household_id", "type") `);
        await queryRunner.query(`CREATE TYPE "public"."notification_preferences_enabled_channels_enum" AS ENUM('in_app', 'email', 'sms', 'push')`);
        await queryRunner.query(`CREATE TYPE "public"."notification_preferences_digest_frequency_enum" AS ENUM('daily', 'weekly', 'monthly', 'never')`);
        await queryRunner.query(`CREATE TYPE "public"."notification_preferences_quiet_hours_mode_enum" AS ENUM('disabled', 'enabled', 'weekdays_only', 'weekends_only')`);
        await queryRunner.query(`CREATE TYPE "public"."notification_preferences_minimum_priority_enum" AS ENUM('low', 'medium', 'high', 'urgent')`);
        await queryRunner.query(`CREATE TYPE "public"."notification_preferences_urgent_override_threshold_enum" AS ENUM('low', 'medium', 'high', 'urgent')`);
        await queryRunner.query(`CREATE TABLE "notification_preferences" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "household_id" uuid NOT NULL, "user_id" uuid NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "enabled_channels" "public"."notification_preferences_enabled_channels_enum" array NOT NULL DEFAULT '{in_app}', "type_settings" jsonb NOT NULL DEFAULT '{}', "digest_frequency" "public"."notification_preferences_digest_frequency_enum" NOT NULL DEFAULT 'weekly', "digest_time" TIME DEFAULT '09:00', "digest_days" integer array, "quiet_hours_mode" "public"."notification_preferences_quiet_hours_mode_enum" NOT NULL DEFAULT 'enabled', "quiet_hours_start" TIME DEFAULT '22:00', "quiet_hours_end" TIME DEFAULT '08:00', "minimum_priority" "public"."notification_preferences_minimum_priority_enum" NOT NULL DEFAULT 'low', "urgent_override_threshold" "public"."notification_preferences_urgent_override_threshold_enum" NOT NULL DEFAULT 'high', "max_notifications_per_hour" integer NOT NULL DEFAULT '10', "max_notifications_per_day" integer NOT NULL DEFAULT '50', "channel_settings" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "UQ_6127a9a9304770fa994d564653f" UNIQUE ("household_id", "user_id"), CONSTRAINT "PK_e94e2b543f2f218ee68e4f4fad2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6127a9a9304770fa994d564653" ON "notification_preferences" ("household_id", "user_id") `);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD CONSTRAINT "FK_64c90edc7310c6be7c10c96f675" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP CONSTRAINT "FK_64c90edc7310c6be7c10c96f675"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6127a9a9304770fa994d564653"`);
        await queryRunner.query(`DROP TABLE "notification_preferences"`);
        await queryRunner.query(`DROP TYPE "public"."notification_preferences_urgent_override_threshold_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_preferences_minimum_priority_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_preferences_quiet_hours_mode_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_preferences_digest_frequency_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_preferences_enabled_channels_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5965df3b146429159d6390c200"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8a1520dea132afb3f4a2a51040"`);
        await queryRunner.query(`DROP TABLE "notification_templates"`);
        await queryRunner.query(`DROP TYPE "public"."notification_templates_default_priority_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_templates_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_templates_channel_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_templates_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7507c8fa44f492099749a4c20e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c04d27330bd5afcb45d5eb66b8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_549819324d7baf7fe9a6902872"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fb6aec00675f57da3646682d0b"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_channels_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_priority_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    }

}

import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateHouseholdEntity1762856250533 implements MigrationInterface {
    name = 'UpdateHouseholdEntity1762856250533'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "households" DROP COLUMN "is_active"`);
        await queryRunner.query(`CREATE TYPE "public"."households_status_enum" AS ENUM('active', 'inactive', 'suspended')`);
        await queryRunner.query(`ALTER TABLE "households" ADD "status" "public"."households_status_enum" NOT NULL DEFAULT 'active'`);
        await queryRunner.query(`ALTER TABLE "households" ADD "default_currency" character varying(3) NOT NULL DEFAULT 'USD'`);
        await queryRunner.query(`ALTER TABLE "households" ADD "timezone" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "households" ADD "address" text`);
        await queryRunner.query(`ALTER TABLE "households" ADD "phone" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "households" ADD "email" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "households" ADD "preferences" jsonb`);
        await queryRunner.query(`ALTER TABLE "households" ADD "member_count" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "households" ADD "total_income" numeric(15,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "households" ADD "total_expenses" numeric(15,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TYPE "public"."users_role_enum" RENAME TO "users_role_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'household_admin', 'member', 'viewer')`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."users_role_enum" USING "role"::"text"::"public"."users_role_enum"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'member'`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum_old" AS ENUM('admin', 'member', 'viewer')`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."users_role_enum_old" USING "role"::"text"::"public"."users_role_enum_old"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'member'`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."users_role_enum_old" RENAME TO "users_role_enum"`);
        await queryRunner.query(`ALTER TABLE "households" DROP COLUMN "total_expenses"`);
        await queryRunner.query(`ALTER TABLE "households" DROP COLUMN "total_income"`);
        await queryRunner.query(`ALTER TABLE "households" DROP COLUMN "member_count"`);
        await queryRunner.query(`ALTER TABLE "households" DROP COLUMN "preferences"`);
        await queryRunner.query(`ALTER TABLE "households" DROP COLUMN "email"`);
        await queryRunner.query(`ALTER TABLE "households" DROP COLUMN "phone"`);
        await queryRunner.query(`ALTER TABLE "households" DROP COLUMN "address"`);
        await queryRunner.query(`ALTER TABLE "households" DROP COLUMN "timezone"`);
        await queryRunner.query(`ALTER TABLE "households" DROP COLUMN "default_currency"`);
        await queryRunner.query(`ALTER TABLE "households" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."households_status_enum"`);
        await queryRunner.query(`ALTER TABLE "households" ADD "is_active" boolean NOT NULL DEFAULT true`);
    }

}

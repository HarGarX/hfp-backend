import { MigrationInterface, QueryRunner } from "typeorm";

export class AddKeycloakIdToUser1762855205384 implements MigrationInterface {
    name = 'AddKeycloakIdToUser1762855205384'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "keycloak_id" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_97b5061278a40c1dead71c1b889" UNIQUE ("keycloak_id")`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_97b5061278a40c1dead71c1b889"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "keycloak_id"`);
    }

}

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { KeycloakService } from './keycloak.service';
import { UserSyncService } from './user-sync.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { KeycloakStrategy } from './strategies/keycloak.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { KeycloakAuthGuard } from './guards/keycloak-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { User } from '../users/entities/user.entity';
import { Household } from '../households/entities/household.entity';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'fallback-secret',
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') || '24h') as any,
        },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([User, Household]),
  ],
  providers: [
    AuthService,
    KeycloakService,
    UserSyncService,
    JwtStrategy,
    KeycloakStrategy,
    JwtAuthGuard,
    KeycloakAuthGuard,
    RolesGuard,
  ],
  controllers: [AuthController],
  exports: [AuthService, KeycloakService, JwtAuthGuard, KeycloakAuthGuard, RolesGuard],
})
export class AuthModule {}

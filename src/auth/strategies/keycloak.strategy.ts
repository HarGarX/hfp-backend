import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import jwksClient from 'jwks-rsa';
import * as jwt from 'jsonwebtoken';
import { UserSyncService } from '../user-sync.service';

export interface KeycloakJwtPayload {
  sub: string; // user id
  email: string;
  preferred_username: string;
  given_name: string;
  family_name: string;
  realm_access: {
    roles: string[];
  };
  resource_access?: {
    [key: string]: {
      roles: string[];
    };
  };
  // Custom claims for household context
  household_id?: string;
  hfp_role?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class KeycloakStrategy extends PassportStrategy(Strategy, 'keycloak') {
  private client: jwksClient.JwksClient;

  constructor(
    private configService: ConfigService,
    private userSyncService: UserSyncService,
  ) {
    const keycloakUrl = configService.get<string>('KEYCLOAK_URL');
    const realm = configService.get<string>('KEYCLOAK_REALM');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: async (request: any, rawJwtToken: any, done: any) => {
        try {
          const key = await this.getSigningKey(rawJwtToken);
          done(null, key);
        } catch (error) {
          done(error);
        }
      },
      algorithms: ['RS256'],
    });

    this.client = jwksClient({
      jwksUri: `${keycloakUrl}/realms/${realm}/protocol/openid_connect/certs`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600000, // 10 minutes
    });
  }

  async validate(payload: KeycloakJwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token: missing subject');
    }

    // Sync user from Keycloak to our database
    const user = await this.userSyncService.syncUserFromKeycloak(payload);

    return {
      id: user.id,
      keycloak_id: payload.sub,
      email: user.email,
      username: payload.preferred_username,
      first_name: user.first_name,
      last_name: user.last_name,
      household_id: user.household_id,
      role: user.role,
      keycloak_roles: payload.realm_access?.roles || [],
    };
  }

  private async getSigningKey(token: string): Promise<string> {
    try {
      const decoded = jwt.decode(token, { complete: true }) as any;
      if (!decoded?.header?.kid) {
        throw new Error('Invalid token: missing key ID');
      }

      const key = await this.client.getSigningKey(decoded.header.kid);
      return key.getPublicKey();
    } catch (error) {
      throw new UnauthorizedException(`Token verification failed: ${error.message}`);
    }
  }
}
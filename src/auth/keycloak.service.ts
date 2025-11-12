import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface KeycloakTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  refresh_token: string;
  token_type: string;
  scope: string;
}

export interface KeycloakUserInfo {
  sub: string;
  email_verified: boolean;
  preferred_username: string;
  given_name: string;
  family_name: string;
  email: string;
}

@Injectable()
export class KeycloakService {
  private readonly logger = new Logger(KeycloakService.name);
  private readonly keycloakUrl: string;
  private readonly realm: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private configService: ConfigService) {
    this.keycloakUrl = this.configService.get<string>('KEYCLOAK_URL', 'http://localhost:8080');
    this.realm = this.configService.get<string>('KEYCLOAK_REALM', 'hfp');
    this.clientId = this.configService.get<string>('KEYCLOAK_CLIENT_ID', 'hfp-backend');
    this.clientSecret = this.configService.get<string>('KEYCLOAK_CLIENT_SECRET', '');
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<KeycloakTokenResponse> {
    try {
      const response = await axios.post(
        `${this.keycloakUrl}/realms/${this.realm}/protocol/openid_connect/token`,
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to exchange code for token', error.response?.data || error.message);
      throw new Error('Token exchange failed');
    }
  }

  async getUserInfo(accessToken: string): Promise<KeycloakUserInfo> {
    try {
      const response = await axios.get(
        `${this.keycloakUrl}/realms/${this.realm}/protocol/openid_connect/userinfo`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get user info', error.response?.data || error.message);
      throw new Error('User info retrieval failed');
    }
  }

  async refreshToken(refreshToken: string): Promise<KeycloakTokenResponse> {
    try {
      const response = await axios.post(
        `${this.keycloakUrl}/realms/${this.realm}/protocol/openid_connect/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to refresh token', error.response?.data || error.message);
      throw new Error('Token refresh failed');
    }
  }

  getLoginUrl(redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
    });

    if (state) {
      params.append('state', state);
    }

    return `${this.keycloakUrl}/realms/${this.realm}/protocol/openid_connect/auth?${params}`;
  }

  getLogoutUrl(redirectUri?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
    });

    if (redirectUri) {
      params.append('post_logout_redirect_uri', redirectUri);
    }

    return `${this.keycloakUrl}/realms/${this.realm}/protocol/openid_connect/logout?${params}`;
  }
}
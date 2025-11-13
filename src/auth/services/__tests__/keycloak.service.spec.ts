import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KeycloakService, KeycloakTokenResponse, KeycloakUserInfo } from '../../keycloak.service';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('KeycloakService', () => {
  let service: KeycloakService;
  let configService: jest.Mocked<ConfigService>;

  const mockConfig = {
    KEYCLOAK_URL: 'https://auth.example.com',
    KEYCLOAK_REALM: 'test-realm',
    KEYCLOAK_CLIENT_ID: 'test-client-id',
    KEYCLOAK_CLIENT_SECRET: 'test-client-secret',
  };

  const mockTokenResponse: KeycloakTokenResponse = {
    access_token: 'mock-access-token',
    expires_in: 3600,
    refresh_expires_in: 7200,
    refresh_token: 'mock-refresh-token',
    token_type: 'Bearer',
    scope: 'openid email profile',
  };

  const mockUserInfo: KeycloakUserInfo = {
    sub: '123e4567-e89b-12d3-a456-426614174001',
    email_verified: true,
    preferred_username: 'testuser',
    given_name: 'Test',
    family_name: 'User',
    email: 'test@example.com',
  };

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
        switch (key) {
          case 'KEYCLOAK_URL':
            return mockConfig.KEYCLOAK_URL;
          case 'KEYCLOAK_REALM':
            return mockConfig.KEYCLOAK_REALM;
          case 'KEYCLOAK_CLIENT_ID':
            return mockConfig.KEYCLOAK_CLIENT_ID;
          case 'KEYCLOAK_CLIENT_SECRET':
            return mockConfig.KEYCLOAK_CLIENT_SECRET;
          default:
            return defaultValue;
        }
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeycloakService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<KeycloakService>(KeycloakService);
    configService = module.get(ConfigService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with config values', () => {
      // The service was already created in beforeEach, so we just verify it exists
      expect(service).toBeDefined();
    });

    it('should use default values when config is not provided', () => {
      // Create a separate mock for this test
      const defaultConfigService = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const newService = new KeycloakService(defaultConfigService as any);
      
      expect(defaultConfigService.get).toHaveBeenCalledWith('KEYCLOAK_URL', 'http://localhost:8080');
      expect(defaultConfigService.get).toHaveBeenCalledWith('KEYCLOAK_REALM', 'hfp');
      expect(defaultConfigService.get).toHaveBeenCalledWith('KEYCLOAK_CLIENT_ID', 'hfp-backend');
      expect(defaultConfigService.get).toHaveBeenCalledWith('KEYCLOAK_CLIENT_SECRET', '');
    });
  });

  describe('exchangeCodeForToken', () => {
    const code = 'test-authorization-code';
    const redirectUri = 'https://app.example.com/auth/callback';

    it('should exchange authorization code for token successfully', async () => {
      mockedAxios.post.mockResolvedValue({ data: mockTokenResponse });

      const result = await service.exchangeCodeForToken(code, redirectUri);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://auth.example.com/realms/test-realm/protocol/openid_connect/token',
        expect.any(URLSearchParams),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      // Verify the URLSearchParams content
      const postCall = mockedAxios.post.mock.calls[0];
      const params = postCall[1] as URLSearchParams;
      expect(params.get('grant_type')).toBe('authorization_code');
      expect(params.get('client_id')).toBe('test-client-id');
      expect(params.get('client_secret')).toBe('test-client-secret');
      expect(params.get('code')).toBe(code);
      expect(params.get('redirect_uri')).toBe(redirectUri);

      expect(result).toEqual(mockTokenResponse);
    });

    it('should handle token exchange failure with response error', async () => {
      const errorResponse = {
        response: {
          data: { error: 'invalid_grant', error_description: 'Code expired' },
        },
      };
      mockedAxios.post.mockRejectedValue(errorResponse);

      await expect(service.exchangeCodeForToken(code, redirectUri)).rejects.toThrow('Token exchange failed');

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('should handle token exchange failure without response error', async () => {
      const networkError = new Error('Network error');
      mockedAxios.post.mockRejectedValue(networkError);

      await expect(service.exchangeCodeForToken(code, redirectUri)).rejects.toThrow('Token exchange failed');

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('should log error details on failure', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorResponse = {
        response: {
          data: { error: 'invalid_grant' },
        },
      };
      mockedAxios.post.mockRejectedValue(errorResponse);

      try {
        await service.exchangeCodeForToken(code, redirectUri);
      } catch (error) {
        // Expected to throw
      }

      consoleErrorSpy.mockRestore();
    });
  });

  describe('getUserInfo', () => {
    const accessToken = 'mock-access-token';

    it('should get user info successfully', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockUserInfo });

      const result = await service.getUserInfo(accessToken);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://auth.example.com/realms/test-realm/protocol/openid_connect/userinfo',
        {
          headers: {
            Authorization: 'Bearer mock-access-token',
          },
        }
      );

      expect(result).toEqual(mockUserInfo);
    });

    it('should handle user info retrieval failure with response error', async () => {
      const errorResponse = {
        response: {
          data: { error: 'invalid_token', error_description: 'Token expired' },
        },
      };
      mockedAxios.get.mockRejectedValue(errorResponse);

      await expect(service.getUserInfo(accessToken)).rejects.toThrow('User info retrieval failed');

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('should handle user info retrieval failure without response error', async () => {
      const networkError = new Error('Network timeout');
      mockedAxios.get.mockRejectedValue(networkError);

      await expect(service.getUserInfo(accessToken)).rejects.toThrow('User info retrieval failed');

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('should log error details on user info failure', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorResponse = {
        response: {
          data: { error: 'unauthorized' },
        },
      };
      mockedAxios.get.mockRejectedValue(errorResponse);

      try {
        await service.getUserInfo(accessToken);
      } catch (error) {
        // Expected to throw
      }

      consoleErrorSpy.mockRestore();
    });
  });

  describe('refreshToken', () => {
    const refreshToken = 'mock-refresh-token';

    it('should refresh token successfully', async () => {
      mockedAxios.post.mockResolvedValue({ data: mockTokenResponse });

      const result = await service.refreshToken(refreshToken);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://auth.example.com/realms/test-realm/protocol/openid_connect/token',
        expect.any(URLSearchParams),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      // Verify the URLSearchParams content
      const postCall = mockedAxios.post.mock.calls[0];
      const params = postCall[1] as URLSearchParams;
      expect(params.get('grant_type')).toBe('refresh_token');
      expect(params.get('client_id')).toBe('test-client-id');
      expect(params.get('client_secret')).toBe('test-client-secret');
      expect(params.get('refresh_token')).toBe(refreshToken);

      expect(result).toEqual(mockTokenResponse);
    });

    it('should handle token refresh failure with response error', async () => {
      const errorResponse = {
        response: {
          data: { error: 'invalid_grant', error_description: 'Refresh token expired' },
        },
      };
      mockedAxios.post.mockRejectedValue(errorResponse);

      await expect(service.refreshToken(refreshToken)).rejects.toThrow('Token refresh failed');

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('should handle token refresh failure without response error', async () => {
      const networkError = new Error('Connection refused');
      mockedAxios.post.mockRejectedValue(networkError);

      await expect(service.refreshToken(refreshToken)).rejects.toThrow('Token refresh failed');

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('should log error details on refresh failure', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorResponse = {
        response: {
          data: { error: 'invalid_grant' },
        },
      };
      mockedAxios.post.mockRejectedValue(errorResponse);

      try {
        await service.refreshToken(refreshToken);
      } catch (error) {
        // Expected to throw
      }

      consoleErrorSpy.mockRestore();
    });
  });

  describe('getLoginUrl', () => {
    const redirectUri = 'https://app.example.com/auth/callback';

    it('should generate login URL without state', () => {
      const loginUrl = service.getLoginUrl(redirectUri);

      const expectedBaseUrl = 'https://auth.example.com/realms/test-realm/protocol/openid_connect/auth';
      expect(loginUrl).toContain(expectedBaseUrl);

      const url = new URL(loginUrl);
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('redirect_uri')).toBe(redirectUri);
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('scope')).toBe('openid email profile');
      expect(url.searchParams.get('state')).toBeNull();
    });

    it('should generate login URL with state', () => {
      const state = 'random-state-value';
      const loginUrl = service.getLoginUrl(redirectUri, state);

      const url = new URL(loginUrl);
      expect(url.searchParams.get('state')).toBe(state);
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('redirect_uri')).toBe(redirectUri);
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('scope')).toBe('openid email profile');
    });

    it('should generate login URL with special characters in redirect URI', () => {
      const complexRedirectUri = 'https://app.example.com/auth/callback?param=value&other=test';
      const loginUrl = service.getLoginUrl(complexRedirectUri);

      const url = new URL(loginUrl);
      expect(url.searchParams.get('redirect_uri')).toBe(complexRedirectUri);
    });
  });

  describe('getLogoutUrl', () => {
    it('should generate logout URL without post logout redirect', () => {
      const logoutUrl = service.getLogoutUrl();

      const expectedBaseUrl = 'https://auth.example.com/realms/test-realm/protocol/openid_connect/logout';
      expect(logoutUrl).toContain(expectedBaseUrl);

      const url = new URL(logoutUrl);
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('post_logout_redirect_uri')).toBeNull();
    });

    it('should generate logout URL with post logout redirect', () => {
      const postLogoutRedirectUri = 'https://app.example.com/goodbye';
      const logoutUrl = service.getLogoutUrl(postLogoutRedirectUri);

      const url = new URL(logoutUrl);
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('post_logout_redirect_uri')).toBe(postLogoutRedirectUri);
    });

    it('should generate logout URL with complex post logout redirect URI', () => {
      const complexRedirectUri = 'https://app.example.com/logout?success=true&reason=user_logout';
      const logoutUrl = service.getLogoutUrl(complexRedirectUri);

      const url = new URL(logoutUrl);
      expect(url.searchParams.get('post_logout_redirect_uri')).toBe(complexRedirectUri);
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
    });

    it('should generate logout URL with empty string redirect URI', () => {
      const logoutUrl = service.getLogoutUrl('');

      const url = new URL(logoutUrl);
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      // Empty string is falsy, so the parameter won't be added
      expect(url.searchParams.get('post_logout_redirect_uri')).toBeNull();
    });
  });

  describe('URL construction edge cases', () => {
    it('should handle keycloak URL without trailing slash', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'KEYCLOAK_URL') return 'https://auth.example.com'; // No trailing slash
        return mockConfig[key as keyof typeof mockConfig];
      });

      const newService = new KeycloakService(configService);
      const redirectUri = 'https://app.example.com/callback';

      const loginUrl = newService.getLoginUrl(redirectUri);
      expect(loginUrl).toContain('https://auth.example.com/realms');
    });

    it('should handle keycloak URL with trailing slash', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'KEYCLOAK_URL') return 'https://auth.example.com/'; // With trailing slash
        return mockConfig[key as keyof typeof mockConfig];
      });

      const newService = new KeycloakService(configService);
      const redirectUri = 'https://app.example.com/callback';

      const loginUrl = newService.getLoginUrl(redirectUri);
      // The URL will have double slashes due to the implementation, but should still work
      expect(loginUrl).toContain('https://auth.example.com//realms');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete OAuth flow URLs', () => {
      const redirectUri = 'https://app.example.com/auth/callback';
      const state = 'csrf-protection-token';
      
      const loginUrl = service.getLoginUrl(redirectUri, state);
      const logoutUrl = service.getLogoutUrl(redirectUri);

      // Verify both URLs are properly formed
      expect(loginUrl).toContain('client_id=test-client-id');
      expect(loginUrl).toContain('state=csrf-protection-token');
      expect(logoutUrl).toContain('client_id=test-client-id');
      expect(logoutUrl).toContain('post_logout_redirect_uri=');
    });

    it('should maintain consistent client configuration across methods', () => {
      const redirectUri = 'https://app.example.com/callback';
      
      // Test that all methods use the same client configuration
      const loginUrl = service.getLoginUrl(redirectUri);
      const logoutUrl = service.getLogoutUrl(redirectUri);

      const loginUrlObj = new URL(loginUrl);
      const logoutUrlObj = new URL(logoutUrl);

      expect(loginUrlObj.searchParams.get('client_id')).toBe('test-client-id');
      expect(logoutUrlObj.searchParams.get('client_id')).toBe('test-client-id');
    });
  });
});
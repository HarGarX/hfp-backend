import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService, LoginResponse } from './auth.service';
import { KeycloakService, KeycloakTokenResponse, KeycloakUserInfo } from './keycloak.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let keycloakService: jest.Mocked<KeycloakService>;

  const mockLoginResponse: LoginResponse = {
    access_token: 'jwt-access-token',
    user: {
      id: 'user-123',
      email: 'test@example.com',
      first_name: 'John',
      last_name: 'Doe',
      role: 'MEMBER',
      household_id: 'household-123',
    },
  };

  const mockResponse = {
    redirect: jest.fn(),
  } as unknown as Response;

  const mockRequest = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      first_name: 'John',
      last_name: 'Doe',
      role: 'MEMBER',
      household_id: 'household-123',
    },
  };

  beforeEach(async () => {
    const mockAuthService = {
      login: jest.fn(),
      register: jest.fn(),
    };

    const mockKeycloakService = {
      getLoginUrl: jest.fn(),
      getLogoutUrl: jest.fn(),
      exchangeCodeForToken: jest.fn(),
      getUserInfo: jest.fn(),
      refreshToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: KeycloakService,
          useValue: mockKeycloakService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
    keycloakService = module.get(KeycloakService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login successfully with valid credentials', async () => {
      authService.login.mockResolvedValue(mockLoginResponse);

      const result = await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(mockLoginResponse);
    });

    it('should handle UnauthorizedException for invalid credentials', async () => {
      authService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      await expect(controller.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should handle BadRequestException for invalid input', async () => {
      authService.login.mockRejectedValue(new BadRequestException('Invalid input data'));

      await expect(controller.login(loginDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@example.com',
      password: 'password123',
      first_name: 'Jane',
      last_name: 'Smith',
    };

    it('should register new user successfully', async () => {
      const newUserResponse = {
        ...mockLoginResponse,
        user: { ...mockLoginResponse.user, email: registerDto.email },
      };
      authService.register.mockResolvedValue(newUserResponse);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(newUserResponse);
    });

    it('should handle BadRequestException for duplicate email', async () => {
      authService.register.mockRejectedValue(new BadRequestException('Email already exists'));

      await expect(controller.register(registerDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('keycloakLogin', () => {
    it('should redirect to Keycloak login URL with custom redirect URI', async () => {
      const redirectUri = 'http://localhost:3000/custom/callback';
      const loginUrl = 'https://keycloak.example.com/auth/login?client_id=hfp';
      keycloakService.getLoginUrl.mockReturnValue(loginUrl);

      await controller.keycloakLogin(redirectUri, mockResponse);

      expect(keycloakService.getLoginUrl).toHaveBeenCalledWith(redirectUri);
      expect(mockResponse.redirect).toHaveBeenCalledWith(loginUrl);
    });

    it('should redirect to Keycloak login URL with default redirect URI', async () => {
      const loginUrl = 'https://keycloak.example.com/auth/login?client_id=hfp';
      keycloakService.getLoginUrl.mockReturnValue(loginUrl);

      await controller.keycloakLogin(null as any, mockResponse);

      expect(keycloakService.getLoginUrl).toHaveBeenCalledWith('http://localhost:3000/auth/keycloak/callback');
      expect(mockResponse.redirect).toHaveBeenCalledWith(loginUrl);
    });
  });

  describe('keycloakCallback', () => {
  const mockTokenResponse: KeycloakTokenResponse = {
    access_token: 'keycloak-access-token',
    refresh_token: 'keycloak-refresh-token',
    expires_in: 3600,
    refresh_expires_in: 86400,
    token_type: 'Bearer',
    scope: 'openid profile email',
  };

  const mockUserInfo: KeycloakUserInfo = {
    sub: 'keycloak-user-id',
    email: 'keycloak@example.com',
    email_verified: true,
    preferred_username: 'keycloak_user',
    given_name: 'Keycloak',
    family_name: 'User',
  };    it('should handle OAuth callback successfully', async () => {
      keycloakService.exchangeCodeForToken.mockResolvedValue(mockTokenResponse);
      keycloakService.getUserInfo.mockResolvedValue(mockUserInfo);

      const result = await controller.keycloakCallback(
        'auth-code-123',
        'oauth-state',
        'http://localhost:3000/auth/keycloak/callback'
      );

      expect(keycloakService.exchangeCodeForToken).toHaveBeenCalledWith(
        'auth-code-123',
        'http://localhost:3000/auth/keycloak/callback'
      );
      expect(keycloakService.getUserInfo).toHaveBeenCalledWith(mockTokenResponse.access_token);
      expect(result).toEqual({
        access_token: mockTokenResponse.access_token,
        refresh_token: mockTokenResponse.refresh_token,
        expires_in: mockTokenResponse.expires_in,
        user: mockUserInfo,
      });
    });

    it('should use default redirect URI when not provided', async () => {
      keycloakService.exchangeCodeForToken.mockResolvedValue(mockTokenResponse);
      keycloakService.getUserInfo.mockResolvedValue(mockUserInfo);

      await controller.keycloakCallback('auth-code-123', 'oauth-state', null as any);

      expect(keycloakService.exchangeCodeForToken).toHaveBeenCalledWith(
        'auth-code-123',
        'http://localhost:3000/auth/keycloak/callback'
      );
    });

    it('should handle BadRequestException for invalid code', async () => {
      keycloakService.exchangeCodeForToken.mockRejectedValue(new BadRequestException('Invalid authorization code'));

      await expect(controller.keycloakCallback('invalid-code', 'state', 'redirect-uri')).rejects.toThrow(BadRequestException);
    });
  });

  describe('refreshToken', () => {
    const refreshToken = 'valid-refresh-token';
    const newTokenResponse: KeycloakTokenResponse = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600,
      refresh_expires_in: 86400,
      token_type: 'Bearer',
      scope: 'openid profile email',
    };

    it('should refresh token successfully', async () => {
      keycloakService.refreshToken.mockResolvedValue(newTokenResponse);

      const result = await controller.refreshToken(refreshToken);

      expect(keycloakService.refreshToken).toHaveBeenCalledWith(refreshToken);
      expect(result).toEqual(newTokenResponse);
    });

    it('should handle UnauthorizedException for invalid refresh token', async () => {
      keycloakService.refreshToken.mockRejectedValue(new UnauthorizedException('Invalid or expired refresh token'));

      await expect(controller.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('keycloakLogout', () => {
    it('should redirect to Keycloak logout URL with custom redirect URI', async () => {
      const redirectUri = 'http://localhost:3000/goodbye';
      const logoutUrl = 'https://keycloak.example.com/auth/logout?redirect_uri=custom';
      keycloakService.getLogoutUrl.mockReturnValue(logoutUrl);

      await controller.keycloakLogout(redirectUri, mockResponse);

      expect(keycloakService.getLogoutUrl).toHaveBeenCalledWith(redirectUri);
      expect(mockResponse.redirect).toHaveBeenCalledWith(logoutUrl);
    });

    it('should redirect to Keycloak logout URL with default redirect URI', async () => {
      const logoutUrl = 'https://keycloak.example.com/auth/logout?redirect_uri=default';
      keycloakService.getLogoutUrl.mockReturnValue(logoutUrl);

      await controller.keycloakLogout(null as any, mockResponse);

      expect(keycloakService.getLogoutUrl).toHaveBeenCalledWith('http://localhost:3000');
      expect(mockResponse.redirect).toHaveBeenCalledWith(logoutUrl);
    });
  });

  describe('getProfile', () => {
    it('should return current user profile', async () => {
      const result = await controller.getProfile(mockRequest as any);

      expect(result).toEqual({ user: mockRequest.user });
    });

    it('should handle request without user context', async () => {
      const emptyRequest = {} as any;
      
      const result = await controller.getProfile(emptyRequest);

      expect(result).toEqual({ user: undefined });
    });
  });
});
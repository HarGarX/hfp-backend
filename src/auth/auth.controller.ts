import { Controller, Post, Body, HttpCode, HttpStatus, Get, Query, Res, UseGuards, ValidationPipe, Request } from '@nestjs/common';
import type { Response, Request as ExpressRequest } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { KeycloakService } from './keycloak.service';
import { KeycloakAuthGuard } from './guards/keycloak-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { LoginResponse } from './auth.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private keycloakService: KeycloakService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'User login',
    description: 'Authenticate a user with email and password. Returns JWT token for subsequent requests.'
  })
  @ApiBody({
    type: LoginDto,
    description: 'User login credentials'
  })
  @ApiOkResponse({
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string', description: 'JWT access token' },
        refresh_token: { type: 'string', description: 'JWT refresh token' },
        expires_in: { type: 'number', description: 'Token expiration time in seconds' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'HOUSEHOLD_ADMIN', 'MEMBER', 'VIEWER'] },
          }
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'User registration',
    description: 'Register a new user account with email, password, and basic profile information.'
  })
  @ApiBody({
    type: RegisterDto,
    description: 'New user registration data'
  })
  @ApiCreatedResponse({
    description: 'User registered successfully',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string', description: 'JWT access token' },
        refresh_token: { type: 'string', description: 'JWT refresh token' },
        expires_in: { type: 'number', description: 'Token expiration time in seconds' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'HOUSEHOLD_ADMIN', 'MEMBER', 'VIEWER'] },
          }
        }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid input data or email already exists' })
  async register(@Body() registerDto: RegisterDto): Promise<LoginResponse> {
    return this.authService.register(registerDto);
  }

  @Get('keycloak/login')
  @ApiOperation({
    summary: 'Keycloak OAuth login',
    description: 'Redirects user to Keycloak login page for OAuth authentication.'
  })
  @ApiQuery({
    name: 'redirect_uri',
    required: false,
    description: 'Callback URL after successful login',
    example: 'http://localhost:3000/auth/keycloak/callback'
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Keycloak login page'
  })
  async keycloakLogin(@Query('redirect_uri') redirectUri: string, @Res() res: Response) {
    const loginUrl = this.keycloakService.getLoginUrl(
      redirectUri || 'http://localhost:3000/auth/keycloak/callback'
    );
    res.redirect(loginUrl);
  }

  @Get('keycloak/callback')
  @ApiOperation({
    summary: 'Keycloak OAuth callback',
    description: 'Handles OAuth callback from Keycloak and exchanges authorization code for tokens.'
  })
  @ApiQuery({
    name: 'code',
    description: 'Authorization code from Keycloak',
    required: true
  })
  @ApiQuery({
    name: 'state',
    description: 'OAuth state parameter',
    required: false
  })
  @ApiQuery({
    name: 'redirect_uri',
    description: 'Redirect URI that was used in the login request',
    required: false
  })
  @ApiOkResponse({
    description: 'OAuth callback processed successfully',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string', description: 'JWT access token' },
        refresh_token: { type: 'string', description: 'JWT refresh token' },
        expires_in: { type: 'number', description: 'Token expiration time in seconds' },
        user: { type: 'object', description: 'User information from Keycloak' }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid authorization code or callback parameters' })
  async keycloakCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('redirect_uri') redirectUri: string,
  ) {
    const tokenResponse = await this.keycloakService.exchangeCodeForToken(
      code,
      redirectUri || 'http://localhost:3000/auth/keycloak/callback'
    );
    
    const userInfo = await this.keycloakService.getUserInfo(tokenResponse.access_token);
    
    return {
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_in: tokenResponse.expires_in,
      user: userInfo,
    };
  }

  @Post('keycloak/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh Keycloak token',
    description: 'Refresh an expired Keycloak access token using the refresh token.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refresh_token: { type: 'string', description: 'Refresh token' }
      },
      required: ['refresh_token']
    }
  })
  @ApiOkResponse({
    description: 'Token refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        refresh_token: { type: 'string' },
        expires_in: { type: 'number' }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  async refreshToken(@Body('refresh_token') refreshToken: string) {
    return this.keycloakService.refreshToken(refreshToken);
  }

  @Get('keycloak/logout')
  @ApiOperation({
    summary: 'Keycloak OAuth logout',
    description: 'Redirects user to Keycloak logout page to terminate the session.'
  })
  @ApiQuery({
    name: 'redirect_uri',
    required: false,
    description: 'URL to redirect to after logout',
    example: 'http://localhost:3000'
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Keycloak logout page'
  })
  async keycloakLogout(@Query('redirect_uri') redirectUri: string, @Res() res: Response) {
    const logoutUrl = this.keycloakService.getLogoutUrl(
      redirectUri || 'http://localhost:3000'
    );
    res.redirect(logoutUrl);
  }

  @Get('profile')
  @UseGuards(KeycloakAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Retrieve the profile information of the currently authenticated user.'
  })
  @ApiOkResponse({
    description: 'User profile retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'HOUSEHOLD_ADMIN', 'MEMBER', 'VIEWER'] },
            household_id: { type: 'string', format: 'uuid', description: 'Current household ID' }
          }
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getProfile(@Request() req: ExpressRequest & { user: any }) {
    return { user: req.user };
  }
}
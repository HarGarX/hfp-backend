import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../auth.guard';
import { TenantContextService } from '../../../tenant';
import { TenantContext } from '../../../tenant/tenant.types';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(async () => {
    const mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    const mockTenantContextService = {
      setTenantContext: jest.fn(),
      getTenantContext: jest.fn(),
      getTenantId: jest.fn(),
      getUserId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: TenantContextService, useValue: mockTenantContextService },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    reflector = module.get(Reflector);
    tenantContextService = module.get(TenantContextService);
  });

  const createMockExecutionContext = (headers: Record<string, string> = {}): ExecutionContext => {
    const request = { headers };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  };

  describe('public routes', () => {
    it('should allow access to public routes', () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockExecutionContext();

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(tenantContextService.setTenantContext).not.toHaveBeenCalled();
    });
  });

  describe('protected routes', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(false); // Not public
    });

    it('should allow access with valid tenant and user headers', () => {
      const validTenantId = '123e4567-e89b-12d3-a456-426614174000';
      const validUserId = '123e4567-e89b-12d3-a456-426614174001';
      
      const context = createMockExecutionContext({
        'x-tenant-id': validTenantId,
        'x-user-id': validUserId,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(tenantContextService.setTenantContext).toHaveBeenCalledWith({
        tenantId: validTenantId,
        userId: validUserId,
      });

      const request = context.switchToHttp().getRequest();
      expect(request.user).toEqual({
        tenantId: validTenantId,
        userId: validUserId,
        roles: ['household_member'],
      });
    });

    it('should allow access with only tenant header', () => {
      const validTenantId = '123e4567-e89b-12d3-a456-426614174000';
      
      const context = createMockExecutionContext({
        'x-tenant-id': validTenantId,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(tenantContextService.setTenantContext).toHaveBeenCalledWith({
        tenantId: validTenantId,
        userId: undefined,
      });

      const request = context.switchToHttp().getRequest();
      expect(request.user.roles).toEqual(['system']);
    });

    it('should throw UnauthorizedException when tenant header is missing', () => {
      const context = createMockExecutionContext();

      expect(() => guard.canActivate(context)).toThrow(
        new UnauthorizedException('Missing x-tenant-id header')
      );
    });

    it('should throw UnauthorizedException when tenant ID format is invalid', () => {
      const context = createMockExecutionContext({
        'x-tenant-id': 'invalid-uuid',
      });

      expect(() => guard.canActivate(context)).toThrow(
        new UnauthorizedException('Invalid x-tenant-id format')
      );
    });

    it('should throw UnauthorizedException when user ID format is invalid', () => {
      const context = createMockExecutionContext({
        'x-tenant-id': '123e4567-e89b-12d3-a456-426614174000',
        'x-user-id': 'invalid-uuid',
      });

      expect(() => guard.canActivate(context)).toThrow(
        new UnauthorizedException('Invalid x-user-id format')
      );
    });
  });

  describe('edge cases', () => {
    it('should handle null reflector gracefully', () => {
      const guardWithoutReflector = new AuthGuard(null as any, tenantContextService);
      const context = createMockExecutionContext({
        'x-tenant-id': '123e4567-e89b-12d3-a456-426614174000',
      });

      // Should not throw - should gracefully proceed to header validation
      expect(guardWithoutReflector.canActivate(context)).toBe(true);
    });

    it('should handle null tenant context service gracefully', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const guardWithoutTenantContext = new AuthGuard(reflector, null as any);
      const context = createMockExecutionContext({
        'x-tenant-id': '123e4567-e89b-12d3-a456-426614174000',
      });

      const result = guardWithoutTenantContext.canActivate(context);
      expect(result).toBe(true); // Should still work with null check
    });
  });
});
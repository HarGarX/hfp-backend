import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard, UserRole } from '../roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    const mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get(Reflector);
  });

  const createMockExecutionContext = (user?: any): ExecutionContext => {
    const request = { user };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  };

  describe('no role requirements', () => {
    it('should allow access when no roles are required', () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockExecutionContext();

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when empty roles array is required', () => {
      reflector.getAllAndOverride.mockReturnValue([]);
      const context = createMockExecutionContext();

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('role-based access control', () => {
    it('should allow access when user has required role', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.HOUSEHOLD_MEMBER]);
      const context = createMockExecutionContext({
        roles: ['household_member'],
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user has higher role (hierarchy)', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.HOUSEHOLD_MEMBER]);
      const context = createMockExecutionContext({
        roles: ['household_admin'], // Higher role
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny access when user has insufficient role', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.HOUSEHOLD_ADMIN]);
      const context = createMockExecutionContext({
        roles: ['household_member'], // Lower role
      });

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Access denied. Required roles: household_admin')
      );
    });

    it('should allow access when user has any of the required roles', () => {
      reflector.getAllAndOverride.mockReturnValue([
        UserRole.ADMIN, 
        UserRole.HOUSEHOLD_ADMIN
      ]);
      const context = createMockExecutionContext({
        roles: ['household_admin'],
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny access when user has none of the required roles', () => {
      reflector.getAllAndOverride.mockReturnValue([
        UserRole.ADMIN, 
        UserRole.HOUSEHOLD_ADMIN
      ]);
      const context = createMockExecutionContext({
        roles: ['household_member'],
      });

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Access denied. Required roles: admin, household_admin')
      );
    });
  });

  describe('error cases', () => {
    it('should throw ForbiddenException when user is not present', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.HOUSEHOLD_MEMBER]);
      const context = createMockExecutionContext(); // No user

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Authentication required for role-based access')
      );
    });

    it('should use default viewer role when user has no explicit roles', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.HOUSEHOLD_VIEWER]);
      const context = createMockExecutionContext({
        roles: [], // Empty roles array
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('role hierarchy', () => {
    it('should respect admin hierarchy (admin can access everything)', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.HOUSEHOLD_VIEWER]);
      const context = createMockExecutionContext({
        roles: ['admin'], // System admin
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should respect household admin hierarchy', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.HOUSEHOLD_VIEWER]);
      const context = createMockExecutionContext({
        roles: ['household_admin'],
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny household member access to admin functions', () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
      const context = createMockExecutionContext({
        roles: ['household_member'],
      });

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Access denied. Required roles: admin')
      );
    });
  });
});
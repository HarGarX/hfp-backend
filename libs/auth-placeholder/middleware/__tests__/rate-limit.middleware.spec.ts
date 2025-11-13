import { RateLimitMiddleware } from '../rate-limit.middleware';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

describe('RateLimitMiddleware', () => {
  let middleware: RateLimitMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    middleware = new RateLimitMiddleware();
    
    mockResponse = {
      set: jest.fn(),
    };
    mockNext = jest.fn();

    // Clear rate limit store before each test
    (middleware as any).rateLimitStore.clear();
  });

  const createMockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
    url: '/test',
    method: 'GET',
    ip: '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' } as any,
    headers: {},
    ...overrides,
  });

  describe('rate limiting by IP', () => {
    it('should allow requests within rate limit', () => {
      mockRequest = createMockRequest();

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '99',
        })
      );
    });

    it('should block requests when rate limit is exceeded', () => {
      mockRequest = createMockRequest();

      // Exhaust the rate limit
      for (let i = 0; i < 100; i++) {
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      }

      // This request should be blocked
      expect(() => 
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext)
      ).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Too many requests'),
          status: HttpStatus.TOO_MANY_REQUESTS,
        })
      );
    });

    it('should reset rate limit after time window expires', () => {
      mockRequest = createMockRequest();
      const store = (middleware as any).rateLimitStore;

      // Make a request to start the rate limit
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Manually expire the rate limit window
      const key = 'ip:127.0.0.1';
      const entry = store.get(key);
      if (entry) {
        entry.resetTime = Date.now() - 1; // Set to past time
        store.set(key, entry);
      }

      // Reset mock to check fresh call
      mockNext.mockClear();
      (mockResponse.set as jest.Mock).mockClear();

      // This should reset the counter
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-RateLimit-Remaining': '99', // Should reset to 99 remaining
        })
      );
    });
  });

  describe('rate limiting by tenant', () => {
    it('should use tenant-based rate limiting when headers present', () => {
      mockRequest = createMockRequest({
        headers: {
          'x-tenant-id': '123e4567-e89b-12d3-a456-426614174000',
          'x-user-id': '123e4567-e89b-12d3-a456-426614174001',
        },
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '99',
        })
      );
    });

    it('should handle different tenants separately', () => {
      // First tenant
      const request1 = createMockRequest({
        headers: { 'x-tenant-id': 'tenant-1' },
      });

      // Second tenant
      const request2 = createMockRequest({
        headers: { 'x-tenant-id': 'tenant-2' },
      });

      // Make requests for tenant 1
      for (let i = 0; i < 50; i++) {
        middleware.use(request1 as Request, mockResponse as Response, mockNext);
      }

      // Tenant 2 should still have full rate limit
      middleware.use(request2 as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.set).toHaveBeenLastCalledWith(
        expect.objectContaining({
          'X-RateLimit-Remaining': '99', // Should be 99 for tenant 2
        })
      );
    });
  });

  describe('different endpoint limits', () => {
    it('should apply stricter limits to login endpoints', () => {
      mockRequest = createMockRequest({ url: '/auth/login' });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-RateLimit-Limit': '5', // Login limit is 5
          'X-RateLimit-Remaining': '4',
        })
      );
    });

    it('should apply higher limits to API endpoints', () => {
      mockRequest = createMockRequest({ url: '/api/users' });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-RateLimit-Limit': '1000', // API limit is 1000
          'X-RateLimit-Remaining': '999',
        })
      );
    });
  });

  describe('cleanup functionality', () => {
    it('should clean up expired entries', () => {
      const store = (middleware as any).rateLimitStore;
      
      // Add some expired entries
      store.set('expired-1', { count: 5, resetTime: Date.now() - 1000 });
      store.set('expired-2', { count: 3, resetTime: Date.now() - 2000 });
      store.set('active', { count: 1, resetTime: Date.now() + 10000 });

      expect(store.size).toBe(3);

      // Trigger cleanup
      (middleware as any).cleanup();

      // Only active entry should remain
      expect(store.size).toBe(1);
      expect(store.has('active')).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should not block requests when rate limiting fails', () => {
      // Create a middleware with a broken store
      const brokenMiddleware = new RateLimitMiddleware();
      jest.spyOn(brokenMiddleware as any, 'generateKey').mockImplementation(() => {
        throw new Error('Test error');
      });

      mockRequest = createMockRequest();

      // Should not throw, just call next
      expect(() => 
        brokenMiddleware.use(mockRequest as Request, mockResponse as Response, mockNext)
      ).not.toThrow();
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  afterEach(() => {
    // Clean up the middleware
    if (middleware && (middleware as any).cleanupInterval) {
      clearInterval((middleware as any).cleanupInterval);
    }
  });
});
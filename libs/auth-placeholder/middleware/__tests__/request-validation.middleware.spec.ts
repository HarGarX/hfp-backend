import { RequestValidationMiddleware } from '../request-validation.middleware';
import { BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

describe('RequestValidationMiddleware', () => {
  let middleware: RequestValidationMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    middleware = new RequestValidationMiddleware();
    
    mockRequest = {
      method: 'GET',
      url: '/test',
      headers: {},
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' } as any,
    };
    
    mockResponse = {};
    mockNext = jest.fn();
  });

  describe('header validation', () => {
    it('should pass validation with valid UUID headers', () => {
      mockRequest.headers = {
        'x-tenant-id': '123e4567-e89b-12d3-a456-426614174000',
        'x-user-id': '123e4567-e89b-12d3-a456-426614174001',
      };

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest).toHaveProperty('requestStartTime');
    });

    it('should pass validation without headers for public routes', () => {
      mockRequest.url = '/health';

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid tenant ID format', () => {
      mockRequest.headers = {
        'x-tenant-id': 'invalid-uuid',
      };

      expect(() => 
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext)
      ).toThrow(new BadRequestException('Invalid x-tenant-id header format'));
    });

    it('should throw BadRequestException for invalid user ID format', () => {
      mockRequest.headers = {
        'x-tenant-id': '123e4567-e89b-12d3-a456-426614174000',
        'x-user-id': 'invalid-uuid',
      };

      expect(() => 
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext)
      ).toThrow(new BadRequestException('Invalid x-user-id header format'));
    });
  });

  describe('content type validation', () => {
    it('should pass validation for POST with correct content type', () => {
      mockRequest.method = 'POST';
      mockRequest.headers = {
        'content-type': 'application/json',
      };

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw BadRequestException for POST without JSON content type', () => {
      mockRequest.method = 'POST';
      mockRequest.headers = {
        'content-type': 'text/plain',
      };

      expect(() => 
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext)
      ).toThrow(new BadRequestException('Content-Type must be application/json for this request'));
    });

    it('should skip content type validation for GET requests', () => {
      mockRequest.method = 'GET';
      mockRequest.headers = {
        'content-type': 'text/plain',
      };

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('body size validation', () => {
    it('should pass validation for normal sized requests', () => {
      mockRequest.method = 'POST';
      mockRequest.headers = {
        'content-type': 'application/json',
        'content-length': '1000',
      };

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw BadRequestException for oversized requests', () => {
      mockRequest.method = 'POST';
      mockRequest.headers = {
        'content-type': 'application/json',
        'content-length': (11 * 1024 * 1024).toString(), // 11MB
      };

      expect(() => 
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext)
      ).toThrow(new BadRequestException('Request body too large'));
    });
  });

  describe('body sanitization', () => {
    it('should sanitize dangerous object keys', () => {
      mockRequest.method = 'POST';
      mockRequest.headers = {
        'content-type': 'application/json',
      };
      
      // Create object with dangerous properties using Object.defineProperty to make them enumerable
      const maliciousBody = { name: 'test' };
      Object.defineProperty(maliciousBody, '__proto__', {
        value: { malicious: 'value' },
        enumerable: true,
        configurable: true,
      });
      Object.defineProperty(maliciousBody, 'constructor', {
        value: { malicious: 'value' },
        enumerable: true,
        configurable: true,
      });
      
      mockRequest.body = maliciousBody;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Check that dangerous keys were removed
      expect(Object.prototype.hasOwnProperty.call(mockRequest.body, '__proto__')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(mockRequest.body, 'constructor')).toBe(false);
      expect(mockRequest.body).toHaveProperty('name', 'test');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize string values', () => {
      mockRequest.method = 'POST';
      mockRequest.headers = {
        'content-type': 'application/json',
      };
      mockRequest.body = {
        text: 'test\x00\n\n\n  with  spaces   ',
      };

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body.text).toBe('test with spaces');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle nested object sanitization', () => {
      mockRequest.method = 'POST';
      mockRequest.headers = {
        'content-type': 'application/json',
      };
      
      // Create nested object with dangerous properties
      const userObject = {
        name: 'test\x00user',
        profile: {
          bio: 'bio\n\n\ntext',
        },
      };
      Object.defineProperty(userObject, '__proto__', {
        value: { malicious: 'value' },
        enumerable: true,
        configurable: true,
      });
      
      mockRequest.body = {
        user: userObject,
      };

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(Object.prototype.hasOwnProperty.call(mockRequest.body.user, '__proto__')).toBe(false);
      expect(mockRequest.body.user.name).toBe('testuser');
      expect(mockRequest.body.user.profile.bio).toBe('bio text');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should log and re-throw validation errors', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockRequest.headers = {
        'x-tenant-id': 'invalid',
      };

      expect(() => 
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext)
      ).toThrow();

      consoleSpy.mockRestore();
    });
  });
});
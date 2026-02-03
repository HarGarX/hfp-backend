import { Injectable, NestMiddleware, BadRequestException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware for validating and sanitizing requests
 */
@Injectable()
export class RequestValidationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestValidationMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    try {
      // Log request for debugging (Phase 1)
      this.logger.debug(`${req.method} ${req.url}`, {
        tenantId: req.headers['x-tenant-id'],
        userId: req.headers['x-user-id'],
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,
      });

      // Validate and sanitize headers
      this.validateHeaders(req);

      // Validate request body size and structure
      this.validateRequestBody(req);

      // Add request timestamp for debugging
      req['requestStartTime'] = Date.now();

      next();
    } catch (error) {
      this.logger.error(`Request validation failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Validate security headers
   */
  private validateHeaders(req: Request) {
    const tenantId = req.headers['x-tenant-id'] as string;
    const userId = req.headers['x-user-id'] as string;

    // Skip validation for public routes
    if (req.url.startsWith('/health') || req.url.startsWith('/metrics') || 
        req.url.startsWith('/api') || req.url.startsWith('/api-json')) {
      return;
    }

    // Validate tenant ID format
    if (tenantId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(tenantId)) {
        throw new BadRequestException('Invalid x-tenant-id header format');
      }
    }

    // Validate user ID format if provided
    if (userId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        throw new BadRequestException('Invalid x-user-id header format');
      }
    }

    // Validate Content-Type for POST/PUT/PATCH (allow multipart for file uploads)
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.headers['content-type'];
      if (contentType && !contentType.includes('application/json') && 
          !contentType.includes('multipart/form-data') && 
          !contentType.includes('application/x-www-form-urlencoded')) {
        throw new BadRequestException('Content-Type must be application/json, multipart/form-data, or application/x-www-form-urlencoded');
      }
    }
  }

  /**
   * Validate request body
   */
  private validateRequestBody(req: Request) {
    // Skip for GET/DELETE requests
    if (['GET', 'DELETE'].includes(req.method)) {
      return;
    }

    // Check body size (basic protection)
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxBodySize = 10 * 1024 * 1024; // 10MB limit

    if (contentLength > maxBodySize) {
      throw new BadRequestException('Request body too large');
    }

    // Basic JSON structure validation (if body exists)
    if (req.body && typeof req.body === 'object') {
      this.sanitizeRequestBody(req.body);
    }
  }

  /**
   * Sanitize request body to prevent injection attacks
   */
  private sanitizeRequestBody(obj: any) {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    // Remove dangerous keys
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    dangerousKeys.forEach(key => {
      if (key in obj) {
        delete obj[key];
      }
    });

    // Recursively sanitize nested objects
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.sanitizeRequestBody(obj[key]);
      }
      
      // Sanitize string values
      if (typeof obj[key] === 'string') {
        obj[key] = this.sanitizeString(obj[key]);
      }
    });
  }

  /**
   * Basic string sanitization
   */
  private sanitizeString(str: string): string {
    if (!str || typeof str !== 'string') {
      return str;
    }

    // Remove null bytes and normalize whitespace
    return str
      .replace(/\x00/g, '') // Remove null bytes
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();
  }
}
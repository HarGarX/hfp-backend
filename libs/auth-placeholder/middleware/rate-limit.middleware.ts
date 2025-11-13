import { Injectable, NestMiddleware, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Simple in-memory rate limiting middleware
 * Phase 2 will replace with Redis-based rate limiting
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private readonly rateLimitStore = new Map<string, RateLimitEntry>();
  private readonly cleanupInterval: NodeJS.Timeout;

  // Rate limit configuration
  private readonly limits = {
    default: { requests: 100, windowMs: 15 * 60 * 1000 }, // 100 requests per 15 minutes
    login: { requests: 5, windowMs: 15 * 60 * 1000 },     // 5 login attempts per 15 minutes
    api: { requests: 1000, windowMs: 15 * 60 * 1000 },    // 1000 API calls per 15 minutes
  };

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  use(req: Request, res: Response, next: NextFunction) {
    try {
      const key = this.generateKey(req);
      const limit = this.getLimit(req);
      
      const current = this.rateLimitStore.get(key) || { count: 0, resetTime: Date.now() + limit.windowMs };
      
      // Reset if window has expired
      if (Date.now() > current.resetTime) {
        current.count = 0;
        current.resetTime = Date.now() + limit.windowMs;
      }

      // Increment count
      current.count++;
      this.rateLimitStore.set(key, current);

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': limit.requests.toString(),
        'X-RateLimit-Remaining': Math.max(0, limit.requests - current.count).toString(),
        'X-RateLimit-Reset': new Date(current.resetTime).toISOString(),
      });

      // Check if limit exceeded
      if (current.count > limit.requests) {
        this.logger.warn(`Rate limit exceeded for ${key}`, {
          count: current.count,
          limit: limit.requests,
          ip: req.ip,
          url: req.url,
        });

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests',
            error: 'Rate limit exceeded',
            retryAfter: current.resetTime,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error(`Rate limiting error: ${error.message}`, error.stack);
      next(); // Don't block requests on rate limiting errors
    }
  }

  /**
   * Generate unique key for rate limiting
   */
  private generateKey(req: Request): string {
    const tenantId = req.headers['x-tenant-id'] as string;
    const userId = req.headers['x-user-id'] as string;
    const ip = req.ip || req.connection.remoteAddress;

    // Prefer tenant-based rate limiting, fallback to IP
    if (tenantId) {
      return `tenant:${tenantId}:${userId || 'anonymous'}`;
    }
    
    return `ip:${ip}`;
  }

  /**
   * Get rate limit configuration based on request type
   */
  private getLimit(req: Request) {
    const url = req.url.toLowerCase();
    
    // Special limits for authentication endpoints
    if (url.includes('/auth/login') || url.includes('/auth/register')) {
      return this.limits.login;
    }
    
    // API endpoints (higher limits for API usage)
    if (url.startsWith('/api/')) {
      return this.limits.api;
    }
    
    // Default limits
    return this.limits.default;
  }

  /**
   * Clean up expired entries from memory
   */
  private cleanup() {
    const now = Date.now();
    const expired: string[] = [];
    
    for (const [key, entry] of this.rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        expired.push(key);
      }
    }
    
    expired.forEach(key => {
      this.rateLimitStore.delete(key);
    });
    
    if (expired.length > 0) {
      this.logger.debug(`Cleaned up ${expired.length} expired rate limit entries`);
    }
  }

  /**
   * Clean up on module destroy
   */
  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
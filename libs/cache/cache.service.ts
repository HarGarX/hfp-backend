import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

/**
 * Multi-tenant cache service with automatic key namespacing
 * Ensures cache isolation between households
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly DEFAULT_TTL = 300; // 5 minutes in seconds

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Build a cache key with household namespace for multi-tenant isolation
   */
  private buildKey(household_id: string, key: string): string {
    return `household:${household_id}:${key}`;
  }

  /**
   * Get cached value
   */
  async get<T>(household_id: string, key: string): Promise<T | undefined> {
    const cacheKey = this.buildKey(household_id, key);
    try {
      const value = await this.cacheManager.get<T>(cacheKey);
      if (value) {
        this.logger.debug(`Cache HIT: ${cacheKey}`);
      } else {
        this.logger.debug(`Cache MISS: ${cacheKey}`);
      }
      return value;
    } catch (error) {
      this.logger.error(`Cache GET error for ${cacheKey}:`, error);
      return undefined;
    }
  }

  /**
   * Set cached value with optional TTL
   */
  async set<T>(
    household_id: string,
    key: string,
    value: T,
    ttl?: number,
  ): Promise<void> {
    const cacheKey = this.buildKey(household_id, key);
    try {
      await this.cacheManager.set(cacheKey, value, ttl || this.DEFAULT_TTL);
      this.logger.debug(
        `Cache SET: ${cacheKey} (TTL: ${ttl || this.DEFAULT_TTL}s)`,
      );
    } catch (error) {
      this.logger.error(`Cache SET error for ${cacheKey}:`, error);
    }
  }

  /**
   * Delete cached value
   */
  async del(household_id: string, key: string): Promise<void> {
    const cacheKey = this.buildKey(household_id, key);
    try {
      await this.cacheManager.del(cacheKey);
      this.logger.debug(`Cache DEL: ${cacheKey}`);
    } catch (error) {
      this.logger.error(`Cache DEL error for ${cacheKey}:`, error);
    }
  }

  /**
   * Delete all cache entries for a household (pattern-based)
   */
  async delPattern(household_id: string, pattern: string): Promise<void> {
    const cachePattern = this.buildKey(household_id, pattern);
    try {
      // Note: This requires Redis SCAN command support
      // For now, we'll just log - full implementation would require direct Redis client
      this.logger.debug(`Cache DEL PATTERN: ${cachePattern}`);
      this.logger.warn(
        'Pattern deletion requires direct Redis client - implement if needed',
      );
    } catch (error) {
      this.logger.error(`Cache DEL PATTERN error for ${cachePattern}:`, error);
    }
  }

  /**
   * Clear all cache for a specific household
   */
  async clearHousehold(household_id: string): Promise<void> {
    this.logger.log(`Clearing all cache for household: ${household_id}`);
    await this.delPattern(household_id, '*');
  }

  /**
   * Wrap a function with caching logic
   */
  async wrap<T>(
    household_id: string,
    key: string,
    fn: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(household_id, key);
    if (cached !== undefined) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn();
    await this.set(household_id, key, result, ttl);
    return result;
  }

  /**
   * Get cache statistics (if supported by cache store)
   */
  async getStats(): Promise<any> {
    try {
      // @ts-ignore - cache-manager doesn't have typed stats method
      return await this.cacheManager.store.getClient().info('stats');
    } catch (error) {
      this.logger.warn('Cache stats not available');
      return null;
    }
  }
}

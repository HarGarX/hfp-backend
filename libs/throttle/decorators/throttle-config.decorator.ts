import { SetMetadata } from '@nestjs/common';

export const THROTTLE_CONFIG_KEY = 'throttleConfig';

export interface ThrottleConfig {
  limit: number;
  ttl: number; // in milliseconds
  name?: string;
}

/**
 * Decorator to set custom throttle configuration for specific endpoints
 * @param config - Custom throttle configuration
 * 
 * @example
 * @ThrottleConfig({ limit: 5, ttl: 60000 }) // 5 requests per minute
 * @Post('expensive-operation')
 * expensiveOperation() {}
 */
export const ThrottleConfig = (config: ThrottleConfig) =>
  SetMetadata(THROTTLE_CONFIG_KEY, config);

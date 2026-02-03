import { Module, Global } from '@nestjs/common';
import { ThrottlerModule as NestThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// ThrottlerStorageRecord interface
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

// Simple Redis storage implementation for throttler
class ThrottlerStorageRedis implements ThrottlerStorage {
  private redis: Redis;
  private scanCount = 1000;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const results = await this.redis
      .multi()
      .incr(key)
      .pttl(key)
      .pexpire(key, ttl)
      .exec();

    if (!results || results.length !== 3) {
      throw new Error('Failed to increment rate limit counter');
    }

    const totalHits = results[0][1] as number;
    const timeToExpire = results[1][1] as number;

    return {
      totalHits,
      timeToExpire: timeToExpire > 0 ? timeToExpire : ttl,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async deleteAll(prefix: string): Promise<void> {
    let cursor = '0';
    do {
      const [newCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${prefix}*`,
        'COUNT',
        this.scanCount,
      );
      cursor = newCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== '0');
  }
}

@Global()
@Module({
  imports: [
    NestThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redis = new Redis({
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
        });

        return {
          throttlers: [
            {
              name: 'anonymous',
              ttl: 3600000, // 1 hour in milliseconds
              limit: 100, // 100 requests per hour
            },
            {
              name: 'authenticated',
              ttl: 3600000, // 1 hour
              limit: 1000, // 1000 requests per hour
            },
            {
              name: 'admin',
              ttl: 3600000,
              limit: 10000, // Effectively unlimited
            },
          ],
          storage: new ThrottlerStorageRedis(redis),
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [NestThrottlerModule],
})
export class ThrottleModule {}

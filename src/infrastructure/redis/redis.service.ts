import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    this.client = new Redis(
      this.configService.getOrThrow<string>('redis.url'),
      {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: false,
      },
    );
  }

  async incrementRateLimit(key: string, ttlSeconds: number): Promise<number> {
    const multi = this.client.multi();
    multi.incr(key);
    multi.expire(key, ttlSeconds, 'NX');
    const result = await multi.exec();
    const count = result?.[0]?.[1];

    return typeof count === 'number' ? count : Number(count ?? 0);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}

import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import {
  AI_PROCESSING_QUEUE,
  DOCUMENT_PROCESSING_QUEUE,
} from '../../core/queue/queue.constants';

function buildBullConnection(redisUrl: string) {
  const parsed = new URL(redisUrl);

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: buildBullConnection(
          configService.getOrThrow<string>('redis.url'),
        ),
        defaultJobOptions: {
          attempts: 5,
          removeOnComplete: 1_000,
          removeOnFail: 5_000,
          backoff: {
            type: 'exponential',
            delay: 5_000,
          },
        },
      }),
    }),
    BullModule.registerQueue(
      { name: DOCUMENT_PROCESSING_QUEUE },
      { name: AI_PROCESSING_QUEUE },
    ),
  ],
  exports: [BullModule],
})
export class InfrastructureBullModule {}

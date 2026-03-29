import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import configuration from './core/config/configuration';
import { validateEnvironment } from './core/config/environment.validation';
import { RedisRateLimitGuard } from './core/security/redis-rate-limit.guard';
import { AuditModule } from './infrastructure/audit/audit.module';
import { InfrastructureBullModule } from './infrastructure/bullmq/bullmq.module';
import { CloudinaryModule } from './infrastructure/cloudinary/cloudinary.module';
import { CometModule } from './infrastructure/comet/comet.module';
import { CryptoModule } from './infrastructure/crypto/crypto.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { AiModule } from './modules/ai/ai.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { AuthModule } from './modules/auth/auth.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { HealthModule } from './modules/health/health.module';
import { InsightsModule } from './modules/insights/insights.module';
import { LabsModule } from './modules/labs/labs.module';
import { MealsModule } from './modules/meals/meals.module';
import { PlansModule } from './modules/plans/plans.module';
import { QueueModule } from './modules/queue/queue.module';
import { UsersModule } from './modules/users/users.module';
import { RequestLoggingMiddleware } from './shared/middleware/request-logging.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnvironment,
      envFilePath: '.env',
    }),
    PrismaModule,
    RedisModule,
    CloudinaryModule,
    CometModule,
    CryptoModule,
    AuditModule,
    InfrastructureBullModule,
    AuthModule,
    UsersModule,
    AiModule,
    LabsModule,
    DocumentsModule,
    MealsModule,
    PlansModule,
    HealthModule,
    InsightsModule,
    AnalyticsModule,
    AssistantModule,
    QueueModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RedisRateLimitGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes('{*path}');
  }
}

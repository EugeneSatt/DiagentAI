function normalizeCloudinaryCloudName(value: string | undefined): string {
  if (!value) {
    return '';
  }

  if (!value.startsWith('cloudinary://')) {
    return value;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}

export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    host: process.env.APP_HOST ?? '0.0.0.0',
    port: Number(process.env.PORT ?? 3000),
    apiPrefix: process.env.API_PREFIX ?? 'api',
  },
  auth: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessTtlSeconds: Number(process.env.JWT_ACCESS_TTL ?? 900),
    refreshTtlSeconds: Number(process.env.JWT_REFRESH_TTL ?? 2_592_000),
  },
  rateLimit: {
    ttlSeconds: Number(process.env.RATE_LIMIT_TTL_SECONDS ?? 60),
    maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120),
  },
  storage: {
    cloudinaryCloudName: normalizeCloudinaryCloudName(
      process.env.CLOUDINARY_CLOUD_NAME,
    ),
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? '',
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
    cloudinaryFolder: process.env.CLOUDINARY_FOLDER ?? 'diagent',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  db: {
    url: process.env.DATABASE_URL ?? '',
    directUrl: process.env.DIRECT_URL ?? '',
  },
  comet: {
    apiUrl: process.env.COMET_API_URL ?? 'https://api.cometapi.com',
    apiKey: process.env.COMET_API_KEY ?? '',
    textModel: process.env.COMET_TEXT_MODEL ?? 'gpt-5-mini',
    visionModel: process.env.COMET_VISION_MODEL ?? 'gpt-5-mini',
    embeddingModel:
      process.env.COMET_EMBEDDING_MODEL ?? 'text-embedding-3-large',
    timeoutMs: Number(process.env.COMET_TIMEOUT_MS ?? 45_000),
  },
  embeddings: {
    dimension: Number(process.env.EMBEDDING_DIMENSION ?? 1536),
  },
  crypto: {
    aesSecretKey: process.env.AES_SECRET_KEY ?? '',
  },
});

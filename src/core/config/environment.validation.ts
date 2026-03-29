import { plainToInstance } from 'class-transformer';
import {
  IsHexadecimal,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  API_PREFIX!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  DIRECT_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsInt()
  @Min(60)
  JWT_ACCESS_TTL!: number;

  @IsInt()
  @Min(3600)
  JWT_REFRESH_TTL!: number;

  @IsInt()
  @Min(1)
  RATE_LIMIT_TTL_SECONDS!: number;

  @IsInt()
  @Min(1)
  RATE_LIMIT_MAX_REQUESTS!: number;

  @IsHexadecimal()
  @IsNotEmpty()
  AES_SECRET_KEY!: string;

  @IsString()
  @IsNotEmpty()
  CLOUDINARY_CLOUD_NAME!: string;

  @IsString()
  @IsNotEmpty()
  CLOUDINARY_API_KEY!: string;

  @IsString()
  @IsNotEmpty()
  CLOUDINARY_API_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  CLOUDINARY_FOLDER!: string;

  @IsUrl({
    require_protocol: true,
  })
  COMET_API_URL!: string;

  @IsString()
  @IsNotEmpty()
  COMET_API_KEY!: string;

  @IsString()
  @IsNotEmpty()
  COMET_TEXT_MODEL!: string;

  @IsString()
  @IsNotEmpty()
  COMET_VISION_MODEL!: string;

  @IsString()
  @IsNotEmpty()
  COMET_EMBEDDING_MODEL!: string;

  @IsInt()
  @Min(1000)
  COMET_TIMEOUT_MS!: number;

  @IsInt()
  @Min(128)
  EMBEDDING_DIMENSION!: number;
}

export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed: ${errors
        .map((error) => Object.values(error.constraints ?? {}).join(', '))
        .join('; ')}`,
    );
  }

  return validated;
}

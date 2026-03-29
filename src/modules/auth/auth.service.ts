import { Injectable } from '@nestjs/common';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginUseCase } from './use-cases/login.use-case';
import { RefreshSessionUseCase } from './use-cases/refresh-session.use-case';
import { RegisterUseCase } from './use-cases/register.use-case';

@Injectable()
export class AuthService {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshSessionUseCase: RefreshSessionUseCase,
  ) {}

  register(
    dto: RegisterDto,
    deviceId: string,
    requestMeta: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthResponseDto> {
    return this.registerUseCase.execute(dto, deviceId, requestMeta);
  }

  login(
    dto: LoginDto,
    deviceId: string,
    requestMeta: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthResponseDto> {
    return this.loginUseCase.execute(dto, deviceId, requestMeta);
  }

  refresh(
    refreshToken: string,
    deviceId: string,
    requestMeta: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthResponseDto> {
    return this.refreshSessionUseCase.execute(
      refreshToken,
      deviceId,
      requestMeta,
    );
  }
}

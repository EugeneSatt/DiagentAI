import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { JwtPayload } from '../../../domain/auth/jwt-payload.interface';
import { addSeconds } from '../../../shared/utils/date.util';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { LoginDto } from '../dto/login.dto';
import { AuthRepository } from '../repositories/auth.repository';

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    dto: LoginDto,
    deviceId: string,
    requestMeta: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthResponseDto> {
    const user = await this.authRepository.findUserByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.authRepository.upsertDevice({
      userId: user.id,
      deviceId,
    });

    const tokens = await this.createSession(user, deviceId, requestMeta);

    await this.auditService.record({
      userId: user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      deviceId,
      ipAddress: requestMeta.ipAddress,
    });

    return tokens;
  }

  private async createSession(
    user: User,
    deviceId: string,
    requestMeta: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthResponseDto> {
    const sessionId = crypto.randomUUID();
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      deviceId,
      sessionId,
    };
    const accessTtlSeconds = this.configService.get<number>(
      'auth.accessTtlSeconds',
      900,
    );
    const refreshTtlSeconds = this.configService.get<number>(
      'auth.refreshTtlSeconds',
      2_592_000,
    );
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('auth.accessSecret'),
      expiresIn: accessTtlSeconds,
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('auth.refreshSecret'),
      expiresIn: refreshTtlSeconds,
    });
    const refreshTokenHash = await argon2.hash(refreshToken);

    await this.authRepository.createRefreshSession({
      id: sessionId,
      user: {
        connect: {
          id: user.id,
        },
      },
      deviceId,
      refreshTokenHash,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
      expiresAt: addSeconds(new Date(), refreshTtlSeconds),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTtlSeconds,
      refreshExpiresIn: refreshTtlSeconds,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }
}

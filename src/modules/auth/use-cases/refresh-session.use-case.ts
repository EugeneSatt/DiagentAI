import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { JwtPayload } from '../../../domain/auth/jwt-payload.interface';
import { addSeconds } from '../../../shared/utils/date.util';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { AuthRepository } from '../repositories/auth.repository';

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    refreshToken: string,
    deviceId: string,
    requestMeta: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthResponseDto> {
    const payload = await this.verifyToken(refreshToken);

    if (payload.deviceId !== deviceId) {
      throw new UnauthorizedException(
        'Refresh token is bound to another device',
      );
    }

    const session = await this.authRepository.findRefreshSessionById(
      payload.sessionId,
    );

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired');
    }

    const tokenMatches = await argon2.verify(
      session.refreshTokenHash,
      refreshToken,
    );

    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.authRepository.findUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const accessTtlSeconds = this.configService.get<number>(
      'auth.accessTtlSeconds',
      900,
    );
    const refreshTtlSeconds = this.configService.get<number>(
      'auth.refreshTtlSeconds',
      2_592_000,
    );
    const nextPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      deviceId,
      sessionId: session.id,
    };
    const accessToken = await this.jwtService.signAsync(nextPayload, {
      secret: this.configService.getOrThrow<string>('auth.accessSecret'),
      expiresIn: accessTtlSeconds,
    });
    const rotatedRefreshToken = await this.jwtService.signAsync(nextPayload, {
      secret: this.configService.getOrThrow<string>('auth.refreshSecret'),
      expiresIn: refreshTtlSeconds,
    });

    await this.authRepository.updateRefreshSession(session.id, {
      refreshTokenHash: await argon2.hash(rotatedRefreshToken),
      expiresAt: addSeconds(new Date(), refreshTtlSeconds),
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    await this.auditService.record({
      userId: user.id,
      action: 'auth.refresh',
      entityType: 'refresh_session',
      entityId: session.id,
      deviceId,
      ipAddress: requestMeta.ipAddress,
    });

    return {
      accessToken,
      refreshToken: rotatedRefreshToken,
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

  private verifyToken(refreshToken: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
      secret: this.configService.getOrThrow<string>('auth.refreshSecret'),
    });
  }
}

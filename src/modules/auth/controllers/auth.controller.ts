import { Body, Controller, Ip, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { DeviceId } from '../../../shared/decorators/device-id.decorator';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { AuthService } from '../auth.service';

@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body() dto: RegisterDto,
    @DeviceId() deviceId: string,
    @Ip() ipAddress: string,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    return this.authService.register(dto, deviceId, {
      ipAddress,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('login')
  login(
    @Body() dto: LoginDto,
    @DeviceId() deviceId: string,
    @Ip() ipAddress: string,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    return this.authService.login(dto, deviceId, {
      ipAddress,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('refresh')
  refresh(
    @Body() dto: RefreshTokenDto,
    @DeviceId() deviceId: string,
    @Ip() ipAddress: string,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    return this.authService.refresh(dto.refreshToken, deviceId, {
      ipAddress,
      userAgent: request.headers['user-agent'],
    });
  }
}

import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtPayload } from '../../../domain/auth/jwt-payload.interface';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { UserProfileDto } from '../dto/user-profile.dto';
import { UpdateUserProfileDto } from '../dto/update-user-profile.dto';
import { UsersService } from '../services/users.service';

@Controller({
  path: 'users',
  version: '1',
})
@UseGuards(AccessTokenGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: JwtPayload): Promise<UserProfileDto> {
    return this.usersService.getProfile(user.sub);
  }

  @Put('me')
  updateMe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateUserProfileDto,
  ): Promise<UserProfileDto> {
    return this.usersService.updateProfile(user.sub, dto);
  }
}

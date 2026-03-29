import { Injectable } from '@nestjs/common';
import { UserProfileDto } from '../dto/user-profile.dto';
import { UpdateUserProfileDto } from '../dto/update-user-profile.dto';
import { UsersRepository } from '../repositories/users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  getProfile(userId: string): Promise<UserProfileDto> {
    return this.usersRepository.getUserProfile(userId);
  }

  updateProfile(
    userId: string,
    dto: UpdateUserProfileDto,
  ): Promise<UserProfileDto> {
    return this.usersRepository.updateUserProfile(userId, dto);
  }
}

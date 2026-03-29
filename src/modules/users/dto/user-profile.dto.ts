export class UserExtendedProfileDto {
  age?: number | null;
  diabetesType?: string | null;
  weightKg?: number | null;
  heightCm?: number | null;
  proteinTarget?: number | null;
  fatTarget?: number | null;
  carbsTarget?: number | null;
  about?: string | null;
  goal?: string | null;
}

export class UserProfileDto {
  id!: string;
  email!: string;
  firstName?: string | null;
  lastName?: string | null;
  timezone!: string;
  locale!: string;
  profile!: UserExtendedProfileDto;
}

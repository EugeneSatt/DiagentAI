export class AuthResponseDto {
  accessToken!: string;
  refreshToken!: string;
  expiresIn!: number;
  refreshExpiresIn!: number;
  user!: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
}

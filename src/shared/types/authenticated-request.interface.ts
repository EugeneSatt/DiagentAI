import { Request } from 'express';
import { JwtPayload } from '../../domain/auth/jwt-payload.interface';

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

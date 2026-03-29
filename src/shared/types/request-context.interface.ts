import { Request } from 'express';
import { JwtPayload } from '../../domain/auth/jwt-payload.interface';

export interface RequestContext extends Request {
  user?: JwtPayload;
  requestId?: string;
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | Record<string, Express.Multer.File[]>;
}

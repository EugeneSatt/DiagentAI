declare module 'compression' {
  import { RequestHandler } from 'express';

  export default function compression(): RequestHandler;
}

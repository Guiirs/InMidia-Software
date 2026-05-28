import { Request, Response } from 'express';

export function rootInfoHandler(_req: Request, res: Response): void {
  res.status(200).json({
    service: 'InMidia API',
    status: 'online',
    version: 'v4',
  });
}

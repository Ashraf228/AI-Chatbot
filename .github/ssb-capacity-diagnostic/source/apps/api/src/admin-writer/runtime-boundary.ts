import type { Request, Response, NextFunction } from 'express';
import { writerRoute } from './protocol';

/** Reject before old multi-statement handlers can produce partial effects. */
export function runtimeAdminBoundary(req: Request, res: Response, next: NextFunction) {
  let pathname: string;
  try { pathname = (req.originalUrl || req.url).split('?')[0].replace(/\/+$/, ''); decodeURIComponent(pathname); }
  catch { res.status(400).json({ message: 'Invalid request' }); return; }
  if (writerRoute(req.method.toUpperCase(), pathname.toLowerCase())) {
    res.status(403).json({ message: 'Separate admin writer required' }); return;
  }
  next();
}

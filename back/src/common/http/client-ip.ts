import type { Request } from 'express';

/** Client IP as resolved by Express according to the configured "trust proxy" setting. */
export function getClientIp(req: Request): string | null {
  const ip = req.ip ?? req.socket.remoteAddress ?? null;
  if (!ip) return null;
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

import type { UserRole } from '@market/shared';

/** Identity attached to the request by AuthGuard. */
export interface AuthUser {
  id: string;
  role: UserRole;
  sessionId: string;
}

// Express merges the global `Express.Request` into its Request type
// (the documented way to extend it; express-serve-static-core is not a direct dependency).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- required by Express typings
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

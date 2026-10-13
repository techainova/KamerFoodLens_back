import { User } from '@prisma/client';

export type SafeUser = Omit<User, 'passwordHash' | 'googleId'>;

// passwordHash and googleId must never leave the process in an API response — every
// endpoint that returns a full Prisma User (admin user list/detail, suspend/ban, etc.)
// goes through this instead of forwarding the raw Prisma row.
export function sanitizeUser(user: User): SafeUser {
  const { passwordHash: _passwordHash, googleId: _googleId, ...safeUser } = user;
  return safeUser;
}

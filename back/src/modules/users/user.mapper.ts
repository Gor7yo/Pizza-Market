import type { UserDto } from '@market/shared';
import type { Account, User } from '../../generated/prisma/client';
import type { FileStorage } from '../../infrastructure/storage/file-storage';

export type UserWithAccounts = User & { accounts: Pick<Account, 'provider'>[] };

export const userWithAccountsInclude = { accounts: { select: { provider: true } } } as const;

export function toUserDto(user: UserWithAccounts, storage: FileStorage): UserDto {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    avatarUrl: storage.urlOrNull(user.avatarKey),
    role: user.role,
    locale: user.locale,
    preferredCurrency: user.preferredCurrency,
    hasPassword: user.passwordHash !== null,
    linkedProviders: user.accounts.map((a) => a.provider.toLowerCase()),
    createdAt: user.createdAt.toISOString(),
  };
}

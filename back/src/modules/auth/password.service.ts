import { Injectable, type OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';

const OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19_456, // OWASP recommended minimum (19 MiB)
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class PasswordService implements OnModuleInit {
  /** Used to spend the same time on unknown e-mails as on wrong passwords. */
  private dummyHash = '';

  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2.hash('dummy-password-for-timing', OPTIONS);
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, OPTIONS);
  }

  async verify(hash: string | null | undefined, password: string): Promise<boolean> {
    try {
      const ok = await argon2.verify(hash || this.dummyHash, password);
      return Boolean(hash) && ok;
    } catch {
      return false;
    }
  }
}

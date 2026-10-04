import { Injectable } from '@nestjs/common';
import type { AddressData, AddressDto } from '@market/shared';
import { AppException } from '../../common/errors/app.exception';
import type { Address, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const MAX_ADDRESSES = 20;

export function toAddressDto(a: Address): AddressDto {
  return {
    id: a.id,
    label: a.label,
    country: a.country,
    city: a.city,
    street: a.street,
    apartment: a.apartment,
    entrance: a.entrance,
    floor: a.floor,
    intercom: a.intercom,
    instructions: a.instructions,
    latitude: a.latitude,
    longitude: a.longitude,
    isDefault: a.isDefault,
  };
}

function toData(input: AddressData) {
  return {
    label: input.label || null,
    country: input.country,
    city: input.city,
    street: input.street,
    apartment: input.apartment || null,
    entrance: input.entrance || null,
    floor: input.floor || null,
    intercom: input.intercom || null,
    instructions: input.instructions || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  };
}

/** Every query is scoped by userId - an address id alone never grants access (IDOR). */
@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<AddressDto[]> {
    const rows = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    return rows.map(toAddressDto);
  }

  async getOwned(userId: string, id: string, tx?: Prisma.TransactionClient): Promise<Address> {
    const address = await (tx ?? this.prisma).address.findFirst({ where: { id, userId } });
    if (!address) throw AppException.notFound('Address');
    return address;
  }

  async create(
    userId: string,
    input: AddressData,
    tx?: Prisma.TransactionClient,
  ): Promise<AddressDto> {
    const run = async (db: Prisma.TransactionClient) => {
      const count = await db.address.count({ where: { userId } });
      if (count >= MAX_ADDRESSES)
        throw AppException.badRequest('BAD_REQUEST', 'Too many saved addresses');
      const isDefault = input.isDefault ?? count === 0;
      if (isDefault) await db.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return db.address.create({ data: { ...toData(input), userId, isDefault } });
    };
    const created = tx ? await run(tx) : await this.prisma.$transaction(run);
    return toAddressDto(created);
  }

  async update(userId: string, id: string, input: AddressData): Promise<AddressDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.getOwned(userId, id, tx);
      if (input.isDefault)
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.update({
        where: { id },
        data: { ...toData(input), isDefault: input.isDefault ?? undefined },
      });
    });
    return toAddressDto(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const address = await this.getOwned(userId, id, tx);
      await tx.address.delete({ where: { id } });
      if (address.isDefault) {
        const next = await tx.address.findFirst({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
        });
        if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
  }
}

import { Injectable } from '@nestjs/common';
import {
  calculateDeliveryFee,
  calculateTotals,
  type CartItemInput,
  type CartQuoteDto,
  type FulfillmentType,
  type PricedCartLineDto,
  type PromoResultDto,
  type StoreSettingsDto,
} from '@market/shared';
import type { Prisma } from '../../generated/prisma/client';
import { FileStorage } from '../../infrastructure/storage/file-storage';
import { SettingsService } from '../settings/settings.service';
import { PricingService, type ResolvedLine } from './pricing.service';
import { type PromoEvaluation, PromoService } from './promo.service';

export interface QuoteInput {
  items: readonly CartItemInput[];
  promoCode?: string;
  fulfillment: FulfillmentType;
  userId: string | null;
}

export interface QuoteResult {
  dto: CartQuoteDto;
  lines: ResolvedLine[];
  promo: PromoEvaluation | null;
  settings: StoreSettingsDto;
}

/**
 * Builds the full price breakdown:
 * base + size + crust + extras -> line totals -> subtotal - discount + delivery = total.
 * Used both for cart previews and (inside the order transaction) for the final order.
 */
@Injectable()
export class QuoteService {
  constructor(
    private readonly pricing: PricingService,
    private readonly promos: PromoService,
    private readonly settingsService: SettingsService,
    private readonly storage: FileStorage,
  ) {}

  async quote(input: QuoteInput, tx?: Prisma.TransactionClient): Promise<QuoteResult> {
    const settings = await this.settingsService.get();
    const lines = await this.pricing.resolve(input.items, tx);
    const subtotal = lines.filter((l) => l.available).reduce((sum, l) => sum + l.lineTotal, 0);

    const promo = input.promoCode
      ? await this.promos.evaluate(input.promoCode, lines, input.userId, tx)
      : null;
    const discount = promo?.ok ? promo.discount : 0;
    const deliveryFee = calculateDeliveryFee(
      input.fulfillment,
      Math.max(0, subtotal - discount),
      settings,
    );
    const totals = calculateTotals(subtotal, discount, deliveryFee);

    const promoDto: PromoResultDto | null = input.promoCode
      ? {
          code: input.promoCode.toUpperCase(),
          applied: Boolean(promo?.ok),
          discount,
          errorCode: promo && !promo.ok ? promo.errorCode : null,
          description: promo?.promo?.description ?? null,
        }
      : null;

    return {
      lines,
      promo,
      settings,
      dto: {
        currency: settings.currency,
        lines: lines.map((l) => this.toLineDto(l)),
        ...totals,
        promo: promoDto,
        minOrderAmount: settings.minOrderAmount,
        freeDeliveryThreshold: settings.freeDeliveryThreshold,
        isAcceptingOrders: settings.isAcceptingOrders,
      },
    };
  }

  private toLineDto(l: ResolvedLine): PricedCartLineDto {
    return {
      key: l.key,
      productId: l.input.productId,
      productSlug: l.product?.slug ?? '',
      name: l.product?.name ?? {},
      imageUrl: this.storage.urlOrNull(l.product?.imageKey),
      sizeId: l.input.sizeId,
      sizeCm: l.size?.sizeCm ?? null,
      crustId: l.input.crustId,
      crustName: l.crust?.name ?? null,
      removedIngredients: l.removed,
      extraIngredients: l.extras,
      quantity: l.input.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
      available: l.available,
      unavailableReason: l.reason,
    };
  }
}

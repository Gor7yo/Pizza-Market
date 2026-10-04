import { assertMinorUnits, multiplyMoney, percentOf, sumMoney } from './money';
import type { FulfillmentType } from './order-status';

/**
 * Pure pricing arithmetic. The API is the only authority: it resolves every
 * modifier from the database and then calls these functions. The web app
 * uses the same functions only for instant previews in the configurator.
 */
export interface UnitPriceInput {
  basePrice: number;
  sizeModifier: number;
  crustModifier: number;
  extraPrices: readonly number[];
}

export function calculateUnitPrice(input: UnitPriceInput): number {
  const unit = sumMoney([
    input.basePrice,
    input.sizeModifier,
    input.crustModifier,
    ...input.extraPrices,
  ]);
  if (unit < 0) throw new RangeError('Unit price cannot be negative');
  return unit;
}

export function calculateLineTotal(unitPrice: number, quantity: number): number {
  return multiplyMoney(unitPrice, quantity);
}

export const PROMO_TYPES = ['PERCENT', 'FIXED'] as const;
export type PromoType = (typeof PROMO_TYPES)[number];

export interface DiscountRule {
  type: PromoType;
  /** PERCENT: integer 1..100, FIXED: minor units */
  value: number;
  /** Optional cap for percent discounts, minor units */
  maxDiscount: number | null;
}

/** Discount never exceeds the eligible subtotal. */
export function calculateDiscount(rule: DiscountRule, eligibleSubtotal: number): number {
  assertMinorUnits(eligibleSubtotal);
  if (eligibleSubtotal <= 0) return 0;
  let discount = rule.type === 'PERCENT' ? percentOf(eligibleSubtotal, rule.value) : rule.value;
  if (rule.maxDiscount !== null) discount = Math.min(discount, rule.maxDiscount);
  return Math.max(0, Math.min(discount, eligibleSubtotal));
}

export interface DeliveryPricing {
  deliveryFee: number;
  /** Delivery is free when the discounted subtotal reaches this amount; null = never */
  freeDeliveryThreshold: number | null;
}

export function calculateDeliveryFee(
  fulfillment: FulfillmentType,
  discountedSubtotal: number,
  pricing: DeliveryPricing,
): number {
  if (fulfillment === 'PICKUP') return 0;
  if (
    pricing.freeDeliveryThreshold !== null &&
    discountedSubtotal >= pricing.freeDeliveryThreshold
  ) {
    return 0;
  }
  return pricing.deliveryFee;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
}

export function calculateTotals(
  subtotal: number,
  discount: number,
  deliveryFee: number,
): OrderTotals {
  assertMinorUnits(subtotal);
  assertMinorUnits(discount);
  assertMinorUnits(deliveryFee);
  const discounted = Math.max(0, subtotal - discount);
  return { subtotal, discount, deliveryFee, total: sumMoney([discounted, deliveryFee]) };
}

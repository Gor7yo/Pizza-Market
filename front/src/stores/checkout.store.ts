import type { FulfillmentType, PaymentMethod } from '@market/shared';
import { makeAutoObservable } from 'mobx';

export type AddressMode = 'saved' | 'new';

/**
 * Checkout UI state that is not a form field: choices that drive which sections
 * are shown, plus the idempotency key of the current checkout attempt.
 */
export class CheckoutStore {
  fulfillment: FulfillmentType = 'DELIVERY';
  addressMode: AddressMode = 'saved';
  selectedAddressId: string | null = null;
  paymentMethod: PaymentMethod = 'CARD';
  /** Same key for retries/double clicks of one attempt => the API never creates two orders. */
  idempotencyKey: string = crypto.randomUUID();

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  setFulfillment(value: FulfillmentType): void {
    this.fulfillment = value;
  }

  setAddressMode(mode: AddressMode): void {
    this.addressMode = mode;
  }

  selectAddress(id: string | null): void {
    this.selectedAddressId = id;
    if (id) this.addressMode = 'saved';
  }

  setPaymentMethod(method: PaymentMethod): void {
    this.paymentMethod = method;
  }

  /** New attempt (after success, or when the server reports the payload changed). */
  renewIdempotencyKey(): void {
    this.idempotencyKey = crypto.randomUUID();
  }
}

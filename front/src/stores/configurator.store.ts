import {
  calculateUnitPrice,
  type CartItemConfig,
  type CartItemInput,
  clampQuantity,
  MAX_ITEM_QUANTITY,
  type ProductDetailDto,
} from '@market/shared';
import { makeAutoObservable } from 'mobx';

/**
 * State of one product configurator. The price shown here is a preview computed
 * with the same shared function the API uses; the API recalculates it anyway.
 */
export class ConfiguratorStore {
  sizeId: string | null;
  crustId: string | null;
  removed = new Set<string>();
  extras = new Set<string>();
  quantity: number;

  constructor(
    readonly product: ProductDetailDto,
    initial?: Partial<CartItemInput>,
  ) {
    const defaultSize = product.sizes.find((s) => s.isDefault) ?? product.sizes[0] ?? null;
    const firstCrust = product.crusts.find((c) => c.isAvailable) ?? null;
    this.sizeId = initial?.sizeId ?? defaultSize?.id ?? null;
    this.crustId = initial?.crustId ?? firstCrust?.id ?? null;
    initial?.removedIngredientIds?.forEach((id) => this.removed.add(id));
    initial?.extraIngredientIds?.forEach((id) => this.extras.add(id));
    this.quantity = clampQuantity(initial?.quantity ?? 1);
    makeAutoObservable(this, { product: false }, { autoBind: true });
  }

  get size() {
    return this.product.sizes.find((s) => s.id === this.sizeId) ?? null;
  }

  get crust() {
    return this.product.crusts.find((c) => c.id === this.crustId) ?? null;
  }

  get defaultIngredients() {
    return this.product.ingredients.filter((i) => i.role === 'DEFAULT');
  }

  get extraIngredients() {
    return this.product.ingredients.filter((i) => i.role === 'EXTRA');
  }

  get unitPrice(): number {
    const extraPrices = this.extraIngredients
      .filter((i) => this.extras.has(i.ingredient.id))
      .map((i) => i.ingredient.extraPrice);
    return calculateUnitPrice({
      basePrice: this.product.basePrice,
      sizeModifier: this.size?.priceModifier ?? 0,
      crustModifier: this.crust?.priceModifier ?? 0,
      extraPrices,
    });
  }

  get total(): number {
    return this.unitPrice * this.quantity;
  }

  get isValid(): boolean {
    if (!this.product.isAvailable) return false;
    if (this.product.isConfigurable && !this.size) return false;
    if (this.product.crusts.length > 0 && !this.crust?.isAvailable) return false;
    return true;
  }

  get config(): CartItemConfig {
    return {
      productId: this.product.id,
      sizeId: this.product.isConfigurable ? this.sizeId : null,
      crustId: this.product.crusts.length > 0 ? this.crustId : null,
      removedIngredientIds: [...this.removed],
      extraIngredientIds: [...this.extras],
    };
  }

  setSize(id: string): void {
    this.sizeId = id;
  }

  setCrust(id: string): void {
    this.crustId = id;
  }

  toggleRemoved(id: string): void {
    if (this.removed.has(id)) this.removed.delete(id);
    else this.removed.add(id);
  }

  toggleExtra(id: string): void {
    if (this.extras.has(id)) this.extras.delete(id);
    else this.extras.add(id);
  }

  setQuantity(quantity: number): void {
    this.quantity = Math.min(MAX_ITEM_QUANTITY, Math.max(1, quantity));
  }
}

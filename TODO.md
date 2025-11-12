# TODO: Fix Variant Name Display in Checkout Summary

## Current Issue
When adding a product variant to the cart, the checkout summary shows the parent product name instead of the variant name.

## Tasks
- [x] Modify `getUserCart` in `lib/actions/cart.ts` to include correct name (variant.name if exists, else product.name)
- [x] Update `CartItem` type in `lib/stores/useCartStore.ts` to include `variantName` optional field
- [x] Modify `CheckoutSummary.tsx` to display the correct name
- [ ] Test the changes in checkout page

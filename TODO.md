# TODO: Fix Stock Display Issue in Product Variants

## Current Work
- Analyzing the issue in app/products/[id] where the displayed stock doesn't change correctly between "Producto Original" and specific variants.
- Identified problem: in getProductById, when there are variants, the product's stock is overwritten with the sum of variant stocks, causing it to always show the sum instead of the base product stock.

## Key Technical Concepts
- Products with variants: system where products can have variants with independent stock.
- Stock management: separation between base product stock and variant stock.
- Frontend state management: useOriginalProduct to toggle between base product and variants.
- Database schema: products.stock and productVariants.stock are separate fields.

## Problem Solving
- Issue: When "Producto Original" is selected, it shows sum of variant stocks instead of base product stock.
- Root cause: getProductById modifies product.stock to be the sum of variant stocks.
- Solution: Remove the stock overwriting logic in getProductById, keep product.stock as the base product stock.

## Pending Tasks and Next Steps
- [x] Modify getProductById in lib/actions/products.ts to not overwrite product.stock when variants exist.
- [ ] Test the fix to ensure "Producto Original" shows base product stock and variant selection shows variant stock.
- [ ] Verify that the change doesn't break other parts of the application that might depend on the current stock calculation.

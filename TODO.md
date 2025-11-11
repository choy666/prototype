# TODO List for Product Attributes Improvements

## Task: Improve app/products/[id] to display dynamic product attributes aesthetically and minimally, inspired by Mercado Libre.

### Steps:

1. **[x] Update types/index.ts**: Add explicit typing for `attributes?: Record<string, string>;` in the `Product` interface to ensure proper TypeScript support.

2. **[x] Edit app/products/[id]/ProductClient.tsx**: 
   - Add a new collapsible section "Características del producto" after the description and before the variants toggle.
   - Render attributes as a minimal vertical list (key-value pairs) using <dl> with Tailwind styles (bg-black/20, rounded-xl, space-y-2).
   - Use Collapsible component for expand/collapse functionality.
   - Make responsive: grid 2-cols on desktop if >4 attributes.
   - Ensure styles match existing theme (text-white/gray-400, capitalize keys).

3. **[x] Test the changes**:
   - Run `npm run dev`.
   - Use `scripts/create-sample-product.ts` to create a sample product with attributes (e.g., { "marca": "Sony", "peso": "4.5kg", "material": "Plástico" }).
   - Navigate to /products/[id] and verify:
     - Attributes display correctly.
     - Collapsible works.
     - Responsive on mobile/desktop.
     - No breakage in existing features (variants, images, cart).

4. **[x] Verify aesthetics**:
   - Compare with Mercado Libre example: Ensure minimal, clean list without overload.
   - Use browser_action to screenshot and confirm.

5. **[x] Cleanup**: Update this TODO.md with [x] marks as steps complete. If issues, note them.

*Estimated time: 30-45 minutes. Dependencies: None new.*

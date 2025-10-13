// components/products/FeaturedGrid.tsx
import { Product } from "@/lib/schema";
import { ProductCard } from "./ProductCard";
import { DiscountBadge } from "@/components/ui/DiscountBadge";   // 🔥 nuevo
import { getDiscountedPrice } from "@/lib/utils/pricing"; // 🔥 nuevo

interface FeaturedGridProps {
  products: Product[];
  onAddToCart?: (id: string) => void;
}

export default function FeaturedGrid({ products, onAddToCart }: FeaturedGridProps) {
  const featured = products.filter((p) => p.destacado);
  const nonFeatured = products.filter((p) => !p.destacado);

  const mainFeatured = featured[0];
  if (!mainFeatured) return null;

  const recommended = featured[1] || nonFeatured[0];
  const fallback =
    (featured[1] ? featured[2] : nonFeatured[1]) ||
    nonFeatured[1] ||
    null;

  const secondary: Product[] = [recommended, fallback].filter(Boolean) as Product[];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-7 bg-black rounded-lg">
      {/* Producto grande a la izquierda */}
      <div className="relative aspect-[4/3] md:aspect-auto md:h-[470px] md:col-span-2 lg:h-[620px]">
        <ProductCard
          key={mainFeatured.id}
          product={mainFeatured}
          onAddToCart={onAddToCart}
          className="h-full w-full object-cover relative"
        />

        {/* Badge de oferta */}
        <DiscountBadge discount={mainFeatured.discount} />

        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-4">
          <h3 className="text-white text-xl font-bold">{mainFeatured.name}</h3>
          <p className="text-xl font-bold">
            {mainFeatured.discount > 0 ? (
              <>
                <span className="line-through text-gray-300 mr-2">
                  ${mainFeatured.price}
                </span>
                <span>${getDiscountedPrice(mainFeatured).toFixed(2)}</span>
              </>
            ) : (
              <>${mainFeatured.price}</>
            )}
          </p>
        </div>
      </div>

      {/* Columna derecha con 2 filas fijas */}
      <div className="grid grid-rows-2 gap-6">
        {secondary.map((product) => (
          <div key={product.id} className="relative aspect-[4/3] md:aspect-auto md:h-[230px] lg:h-[300px]">
            <ProductCard
              product={product}
              onAddToCart={onAddToCart}
              className="h-full w-full object-cover relative"
            />

            {/* Badge de oferta */}
            <DiscountBadge discount={product.discount} />

            <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-3">
              <h3 className="text-white text-xl font-bold">{product.name}</h3>
              <p className="font-bold">
                {product.discount > 0 ? (
                  <>
                    <span className="line-through text-gray-300 mr-2">
                      ${product.price}
                    </span>
                    <span>${getDiscountedPrice(product).toFixed(2)}</span>
                  </>
                ) : (
                  <>${product.price}</>
                )}
              </p>
            </div>
          </div>
        ))}

        {secondary.length < 2 && (
          <div className="aspect-[4/3] md:aspect-auto md:h-[240px]" />
        )}
      </div>
    </div>
  );
}
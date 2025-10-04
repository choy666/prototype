// components/products/FeaturedGrid.tsx
import { Product } from "@/lib/schema";
import { ProductCard } from "./ProductCard";

interface FeaturedGridProps {
  products: Product[];
  onAddToCart?: (id: string) => void;
}

export default function FeaturedGrid({ products, onAddToCart }: FeaturedGridProps) {
  const featured = products.filter((p) => p.destacado);
  const nonFeatured = products.filter((p) => !p.destacado);

  // Producto grande: siempre destacado
  const mainFeatured = featured[0];
  if (!mainFeatured) return null;

  // Producto recomendado (derecha arriba)
  const recommended = featured[1] || nonFeatured[0];

  // Producto fallback (derecha abajo)
  const fallback =
    (featured[1] ? featured[2] : nonFeatured[1]) ||
    nonFeatured[1] ||
    null;

  // Array final de secundarios
  const secondary: Product[] = [recommended, fallback].filter(Boolean) as Product[];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-7 bg-black rounded-lg">
      {/* Producto grande a la izquierda */}
      <div className="relative aspect-[4/3] md:aspect-auto md:h-[500px] md:col-span-2">
        <ProductCard
          key={mainFeatured.id}
          product={mainFeatured}
          onAddToCart={onAddToCart}
          className="h-full w-full object-cover relative"
        />
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-4">
          <h3 className="text-white text-2xl font-bold">{mainFeatured.name}</h3>
          <p className="text-2xl font-bold">${mainFeatured.price}</p>
        </div>
      </div>

      {/* Columna derecha con 2 filas fijas */}
      <div className="grid grid-rows-2 gap-6">
        {secondary.map((product) => (
          <div key={product.id} className="relative aspect-[4/3] md:aspect-auto md:h-[240px]">
            <ProductCard
              product={product}
              onAddToCart={onAddToCart}
              className="h-full w-full object-cover relative"
            />
            <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-3">
              <h3 className="text-white text-xl font-bold">{product.name}</h3>
              <p className="font-bold">${product.price}</p>
            </div>
          </div>
        ))}

        {/* Si solo hay un secundario, reservamos espacio */}
        {secondary.length < 2 && (
          <div className="aspect-[4/3] md:aspect-auto md:h-[240px]" />
        )}
      </div>
    </div>
  );
}
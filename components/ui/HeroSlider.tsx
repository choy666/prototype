// components/ui/HeroSlider.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { Product } from "@/lib/schema";
import { useEffect, useState } from "react";
import { getAllProducts } from "@/lib/actions/products"; // 🔥 ahora trae todos

export default function HeroSlider() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProducts() {
      const all = await getAllProducts(); // 🔥 sin filtros
      setProducts(all);
      setLoading(false);
    }

    fetchProducts();
  }, []);

  // 🌀 Estado de carga visual - skeleton
  if (loading) {
    return (
      <div className="bg-black p-6 rounded-lg overflow-x-auto">
        <ul className="inline-flex gap-6 whitespace-nowrap animate-pulse">
          {Array.from({ length: 5 }).map((_, idx) => (
            <li
              key={`skeleton-${idx}`}
              className="relative flex-none w-2/3 md:w-1/3 max-w-[400px] aspect-[4/3] rounded-lg overflow-hidden border bg-muted"
            >
              <div className="w-full h-full bg-muted-foreground opacity-20" />
              <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="h-6 w-3/4 bg-muted-foreground rounded mb-2" />
                <div className="h-5 w-1/2 bg-yellow-400/30 rounded" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // 🌀 Estado sin productos
  if (products.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-muted rounded-lg">
        <p className="text-muted-foreground">No hay productos disponibles</p>
      </div>
    );
  }

  // ⚡ Duración proporcional: más productos = más tiempo
  const baseDuration = products.length; //
  const mobileDuration = `${baseDuration}s`;
  const desktopDuration = `${baseDuration}s`;

  return (
    <div className="group bg-black p-6 rounded-lg overflow-x-hidden">
      <ul
        className={`
          inline-flex gap-6 whitespace-nowrap w-max
          animate-carousel
          [animation-duration:${mobileDuration}]
          md:[animation-duration:${desktopDuration}]
          group-hover:[animation-play-state:paused]
        `}
      >
        {products.map((product) => (
          <li
            key={product.id}
            className="relative flex-none w-2/3 md:w-1/3 max-w-[400px] aspect-[4/3] rounded-lg overflow-hidden border"
          >
            <Link href={`/products/${product.id}`}>
              <Image
                src={product.image || "/placeholder-product.jpg"}
                alt={product.name}
                width={600}
                height={400}
                className="w-full h-full object-cover"
              />
              {/* Overlay inferior */}
              <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-4">
                <h2 className="text-white text-lg md:text-xl font-bold">
                  {product.name}
                </h2>
                <p className="text-base md:text-lg font-bold">
                  ${product.price}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
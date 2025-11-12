"use client";

import Image from "next/image";
import Link from "next/link";
import { Product } from "@/lib/schema";
import { useEffect, useMemo, useState } from "react";
import { getAllProducts } from "@/lib/actions/products";
import { useKeenSlider, KeenSliderInstance } from "keen-slider/react"; // ✅ importamos el tipo
import { usePathname } from "next/navigation";
import "keen-slider/keen-slider.min.css";
import { DiscountBadge } from "@/components/ui/DiscountBadge";
import { getDiscountedPrice } from "@/lib/utils/pricing";
import { formatPrice } from "@/lib/utils";

/**
 * Plugin autoplay slide-a-slide con cleanup completo y pausa por visibilidad.
 */
function AutoplaySlides(getInterval: () => number) {
  return (slider: KeenSliderInstance) => { // ✅ tipado correcto
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let mouseOver = false;
    let pageHidden = false;

    const clearNextTimeout = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    const nextTimeout = () => {
      clearNextTimeout();
      if (mouseOver || pageHidden) return;
      timeout = setTimeout(() => {
        // Si el slider está destruido o no tiene container, no avanzar.
        if (!slider || !slider.container) return;
        slider.next();
      }, getInterval());
    };

    const onMouseEnter = () => {
      mouseOver = true;
      clearNextTimeout();
    };
    const onMouseLeave = () => {
      mouseOver = false;
      nextTimeout();
    };

    const onVisibilityChange = () => {
      pageHidden = document.hidden;
      if (pageHidden) {
        clearNextTimeout();
      } else {
        nextTimeout();
      }
    };

    slider.on("created", () => {
      slider.container.addEventListener("mouseenter", onMouseEnter);
      slider.container.addEventListener("mouseleave", onMouseLeave);
      document.addEventListener("visibilitychange", onVisibilityChange);
      nextTimeout();
    });

    slider.on("dragStarted", clearNextTimeout);
    slider.on("animationEnded", nextTimeout);
    slider.on("updated", nextTimeout);

    slider.on("destroyed", () => {
      clearNextTimeout();
      slider.container.removeEventListener("mouseenter", onMouseEnter);
      slider.container.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    });
  };
}

export default function HeroSlider() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;
    async function fetchProducts() {
      const all = await getAllProducts();
      if (!mounted) return;
      const shuffled = [...all].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(10, all.length));
      setProducts(selected);
      setLoading(false);
    }
    fetchProducts();
    return () => {
      mounted = false;
    };
  }, []);

  // Intervalo por breakpoint (mobile lento, desktop más rápido)
  const getInterval = useMemo(() => {
    return () => {
      if (typeof window !== "undefined") {
        if (window.innerWidth >= 1024) return 2500; // desktop
        if (window.innerWidth >= 640) return 3500;  // tablet
      }
      return 4500; // mobile
    };
  }, []);

  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>(
    {
      loop: true,
      renderMode: "performance",
      drag: true,
      slides: {
        perView: 1,
        spacing: 16,
      },
      breakpoints: {
        "(min-width: 640px)": {
          slides: { perView: 2, spacing: 20 },
        },
        "(min-width: 1024px)": {
          slides: { perView: 3, spacing: 24 },
        },
      },
    },
    [AutoplaySlides(getInterval)]
  );

  // Key de remount robusto
  const [clientSalt, setClientSalt] = useState(0);
  useEffect(() => {
    setClientSalt((s) => s + 1);
  }, [pathname]);

  const remountKey = useMemo(
    () => `${pathname}-${products.length}-${clientSalt}`,
    [pathname, products.length, clientSalt]
  );

  if (loading) {
    return (
      <div className="bg-black p-6 rounded-lg overflow-hidden">
        <div className="flex gap-6 animate-pulse">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={`skeleton-${idx}`}
              className="w-full md:w-1/2 lg:w-1/3 aspect-[4/3] rounded-lg bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-muted rounded-lg">
        <p className="text-muted-foreground">No hay productos disponibles</p>
      </div>
    );
  }

  const handlePrev = () => {
    const inst = instanceRef.current;
    if (!inst) return;
    inst.prev();
  };
  const handleNext = () => {
    const inst = instanceRef.current;
    if (!inst) return;
    inst.next();
  };

  return (
    <div className="group relative bg-black p-4 md:p-6 rounded-lg overflow-hidden">
      {/* Botones manuales */}
      <button
        onClick={handlePrev}
        aria-label="Anterior"
        className="absolute left-2 top-1/2 -translate-y-1/2 z-20
                   bg-black/50 text-white p-3 rounded-full hover:bg-black min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        ◀
      </button>
      <button
        onClick={handleNext}
        aria-label="Siguiente"
        className="absolute right-2 top-1/2 -translate-y-1/2 z-20
                   bg-black/50 text-white p-3 rounded-full hover:bg-black min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        ▶
      </button>

      <div className="mx-auto max-w-6xl">
        <div
          key={remountKey}
          ref={sliderRef}
          className="keen-slider"
          role="region"
          aria-roledescription="Carrusel"
          aria-label="Productos destacados"
          aria-live="polite"
        >
          {products.map((product) => {
            const hasDiscount = product.discount && product.discount > 0;
            const finalPrice = getDiscountedPrice(product);

            return (
              <div
                key={product.id}
                className="keen-slider__slide w-full sm:w-1/2 lg:w-1/3 flex-shrink-0"
              >
                <Link
                  href={`/products/${product.id}`}
                  className="block relative aspect-[4/3] rounded-lg overflow-hidden border"
                >
                  <Image
                    src={product.image || "/placeholder-product.jpg"}
                    alt={
                      product.image
                        ? `Imagen destacada del producto ${product.name}`
                        : `Imagen no disponible para el producto ${product.name}`
                    }
                    width={600}
                    height={400}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    placeholder="blur"
                    blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+IRjWjBqO6O2mhP//Z"
                    className="w-full h-full object-cover"
                    priority={true}
                  />
                  {hasDiscount && <DiscountBadge discount={product.discount} />}
                  <div
                    className="absolute bottom-0 left-0 w-full
                                bg-gradient-to-t from-black/80 to-transparent p-4"
                  >
                    <h2 className="text-white text-lg md:text-xl font-bold">
                      {product.name}
                    </h2>
                    <div className="text-base md:text-lg font-bold">
                      {hasDiscount ? (
                        <div className="flex flex-col items-start">
                          <span className="text-xs text-muted-foreground line-through text-white">
                            {formatPrice(Number(product.price))}
                          </span>
                          <span className="text-primary">
                            {formatPrice(finalPrice)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-primary">
                          {formatPrice(Number(product.price))}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
// components/ui/DiscountBadge.tsx
export function DiscountBadge({ discount }: { discount: number }) {
  if (!discount || discount <= 0) return null;

  return (
    <div
      aria-label={`Descuento del ${discount}%`}
      className="absolute top-2 right-2 bg-red-600 text-white text-xs md:text-sm font-bold px-2 md:px-3 py-1 rounded-full shadow-lg animate-bounce"
    >
      -{discount}%
    </div>
  );
}
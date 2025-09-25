import { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Productos',
    template: '%s | Mi Tienda'
  },
  description: 'Explora nuestra colección de productos',
  // Metadatos opcionales para redes sociales
  openGraph: {
    title: 'Productos | Mi Tienda',
    description: 'Descubre nuestra amplia gama de productos',
    type: 'website',
  },
  // Para evitar advertencias de TypeScript
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
};

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Configuración para imágenes
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Permite todas las imágenes HTTPS
      },
    ],
  },
  

  // Configuración de cabeceras de seguridad
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  //recursos
  reactStrictMode: true,
  
  // Configuración para entornos de desarrollo
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
}

// Cabeceras de seguridad recomendadas
const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  }
];

export default nextConfig;
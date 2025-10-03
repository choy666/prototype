import type { NextConfig } from 'next';

// Determinar si estamos usando Turbopack
const isTurbopack = process.env.TURBOPACK === '1';

// Cabeceras de seguridad recomendadas
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
];

// Configuración base
const baseConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Permite todas las imágenes HTTPS
      },
    ],
  },

  compiler: {
    styledComponents: true,
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/api/auth/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ];
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '8mb',
      allowedOrigins: ['localhost:3000', 'https://prototype-ten-dun.vercel.app'],
    },
  },
};

// Configuración específica para Webpack (solo cuando no se usa Turbopack)
const webpackConfig: Partial<NextConfig> = !isTurbopack
  ? {
      webpack: (config, { isServer, webpack }) => {
        if (!isServer) {
          config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            crypto: false,
            stream: false,
            http: false,
            https: false,
            zlib: false,
            path: false,
            os: false,
            net: false,
            tls: false,
          };
        }

        config.plugins.push(
          new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
          })
        );

        return config;
      },
      transpilePackages: ['bcryptjs'],
    }
  : {};

// Combinar configuraciones
const nextConfig: NextConfig = {
  ...baseConfig,
  ...webpackConfig,
};

export default nextConfig;

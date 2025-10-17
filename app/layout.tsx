// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/components/auth-provider'
import Navbar from '@/components/ui/Navbar'
import Footer from '@/components/ui/Footer'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { auth } from '@/lib/actions/auth'
import { logger } from '@/lib/utils/logger'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Mi Tienda',
  description: 'Tu tienda en línea favorita',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background text-foreground`}>
        <ErrorBoundary
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-red-600 mb-4">
                  ¡Ups! Algo salió mal
                </h1>
                <p className="text-gray-600 mb-4">
                  Ha ocurrido un error inesperado. Por favor, recarga la página.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Recargar página
                </button>
              </div>
            </div>
          }
          onError={(error, errorInfo) => {
            logger.error('Error capturado por ErrorBoundary global', {
              error: error.message,
              stack: error.stack,
              componentStack: errorInfo.componentStack
            });
          }}
        >
          <AuthProvider session={session}>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <Navbar />
                {children}
              <Footer />
            </ThemeProvider>
          </AuthProvider>
        </ErrorBoundary>
        <Toaster />
      </body>
    </html>
  )
}

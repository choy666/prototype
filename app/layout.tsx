// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import ErrorFallback from '@/components/ui/ErrorFallback'
import { ConditionalLayout } from './ConditionalLayout'
import { auth } from '@/lib/actions/auth'

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
          fallback={<ErrorFallback />}
        >
          <ConditionalLayout session={session}>
            {children}
          </ConditionalLayout>
        </ErrorBoundary>
        <Toaster />
      </body>
    </html>
  )
}

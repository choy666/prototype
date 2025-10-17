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
import ErrorFallback from '@/components/ui/ErrorFallback'
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

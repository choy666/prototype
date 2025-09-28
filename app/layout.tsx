// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/components/auth-provider'
import Navbar from '@/components/ui/Navbar'
import Footer from '@/components/ui/Footer'
import { getServerSession } from '@/lib/actions/auth'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Mi Aplicación',
  description: 'Sistema de gestión de contenido',
  // viewport y themeColor se han movido a app/viewport.ts
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession()

  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background text-foreground`}>
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
        <Toaster />
      </body>
    </html>
  )
}
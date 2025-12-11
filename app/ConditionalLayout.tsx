'use client'

// app/ConditionalLayout.tsx
import { usePathname } from 'next/navigation'
import { AuthProvider } from '@/components/auth-provider'
import { ThemeProvider } from '@/components/theme-provider'
import Navbar from '@/components/ui/Navbar'
import Footer from '@/components/ui/Footer'
import { SkipLink } from '@/components/ui/SkipLink'

interface ConditionalLayoutProps {
  children: React.ReactNode
  session: unknown
}

export function ConditionalLayout({ children, session }: ConditionalLayoutProps) {
  const pathname = usePathname()
  const isPaymentSuccess = pathname === '/payment-success'
  
  return (
    <AuthProvider session={session}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <SkipLink />
        {/* Ocultar navbar en payment-success para evitar navegación durante redirect */}
        {!isPaymentSuccess && <Navbar />}
        <main id="main-content">
          {children}
        </main>
        {/* Ocultar footer en payment-success para mantener experiencia limpia */}
        {!isPaymentSuccess && <Footer />}
      </ThemeProvider>
    </AuthProvider>
  )
}

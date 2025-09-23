'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'
import { Toaster } from '@/components/ui/toaster'
import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'

type ProvidersProps = {
  children: ReactNode
} & ThemeProviderProps

export function Providers({ children, ...props }: ProvidersProps) {
  return (
    <SessionProvider>
      <NextThemesProvider 
        attribute="class" 
        defaultTheme="system" 
        enableSystem
        disableTransitionOnChange
        {...props}
      >
        {children}
        <Toaster />
      </NextThemesProvider>
    </SessionProvider>
  )
}
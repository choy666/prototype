import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/components/auth-provider';
import Navbar from '../components/ui/Navbar';
import Footer from '../components/ui/Footer';
import { auth } from '@/lib/actions/auth';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Mi Aplicación',
  description: 'Sistema de gestión de contenido',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background text-foreground`}>
        <AuthProvider session={session}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Navbar />
            {children}
          <Footer />
          </ThemeProvider>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
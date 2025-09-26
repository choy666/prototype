'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, Menu, X, House, User } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import '../../app/globals.css';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();

  // Efecto para manejar el scroll
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { name: 'Inicio', href: '/' },
    { name: 'Productos', href: '/products' },
  ];

  const authItems = session 
    ? [
        { name: 'Mi Cuenta', href: '/dashboard' },
        { 
          name: 'Cerrar Sesión', 
          onClick: () => signOut({ callbackUrl: '/' }) 
        }
      ]
    : [
        { name: 'Iniciar Sesión', href: '/login' },
        { name: 'Registrarse', href: '/register' }
      ];

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-200 border-b',
        isScrolled 
          ? 'bg-background/80 backdrop-blur-md border-border/50' 
          : 'bg-background border-border/30'
      )}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Navegación principal">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link
              href="/"
              className="flex items-center group transition-all duration-300 hover:scale-105 active:scale-95"
              aria-label="Ir al inicio"
            >
              <House className="h-6 w-6 mr-2 text-primary" />
              <span className="text-xl font-bold text-foreground transition-colors duration-300 group-hover:opacity-80">
                MiTienda
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'text-sm font-medium transition-colors',
                  pathname === item.href
                    ? 'text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Right side icons */}
          <div className="flex items-center space-x-4">
            <Link 
              href="/cart" 
              className="p-2 text-foreground/80 hover:text-foreground transition-colors relative"
              aria-label="Carrito de compras"
            >
              <ShoppingCart className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                0
              </span>
            </Link>

            {/* Menú de usuario autenticado */}
            {status === 'authenticated' ? (
              <div className="hidden md:block relative group">
                <button
                  className="flex items-center space-x-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  aria-haspopup="true"
                  aria-expanded={isOpen}
                  onClick={() => setIsOpen(!isOpen)}
                >
                
                <User className="cursor-pointer h-6 w-6 transition-all duration-300 hover:scale-105 active:scale-95 " />
                
                </button>
                {isOpen && (
                  <div 
                    className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-popover border border-border py-1 z-50"
                    onMouseLeave={() => setIsOpen(false)}
                  >
                    <Link
                      href="/dashboard"
                      className="block px-4 py-2 text-sm text-foreground hover:bg-accent"
                      onClick={() => setIsOpen(false)}
                    >
                      Mi Cuenta
                    </Link>
                    <button
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-accent cursor-pointer"
                    >
                      Cerrar Sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden md:flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  asChild
                  className="text-sm"
                >
                  <Link href="/login">Iniciar Sesión</Link>
                </Button>
                <Button 
                  size="sm"
                  asChild
                  className="text-sm"
                >
                  <Link href="/register">Registrarse</Link>
                </Button>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-foreground hover:text-primary focus:outline-none"
              onClick={() => setIsOpen(!isOpen)}
              aria-expanded={isOpen}
              aria-label="Menú de navegación"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isOpen && (
          <div className="md:hidden pt-2 pb-4 space-y-4">

            {/* Mobile Navigation Links */}
            <div className="px-2 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'block px-3 py-2 rounded-md text-base font-medium',
                    pathname === item.href
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  {item.name}
                </Link>
              ))}

              {/* Auth Links */}
              {authItems.map((item) => (
                item.href ? (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                    onClick={() => setIsOpen(false)}
                  >
                    {item.name}
                  </Link>
                ) : (
                  <button
                    key={item.name}
                    onClick={() => {
                      item.onClick?.();
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    {item.name}
                  </button>
                )
              ))}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Navbar;
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, Menu, X, House, User, LayoutDashboard, Package, ShoppingCart as ShoppingCartIcon, Users, BarChart3, Tag } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useCartStore, selectTotalItems } from '@/lib/stores/useCartStore';

const Navbar = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();

  // ✅ Traemos el total de items del carrito
  const totalItems = useCartStore(selectTotalItems);

  // Determinar si el usuario es admin
  const isAdmin = session?.user?.role === 'admin';

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Navegación condicional según el rol
  const navItems = isAdmin ? [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Productos', href: '/admin/products', icon: Package },
    { name: 'Categorías', href: '/admin/categories', icon: Tag },
    { name: 'Pedidos', href: '/admin/orders', icon: ShoppingCartIcon },
    { name: 'Usuarios', href: '/admin/users', icon: Users },
    { name: 'Reportes', href: '/admin/reports', icon: BarChart3 },
  ] : [
    { name: 'Inicio', href: '/' },
    { name: 'Productos', href: '/products' },
  ];

  const authItems = session
    ? isAdmin
      ? [
          {
            name: 'Cerrar Sesión',
            onClick: () => signOut({ callbackUrl: '/' })
          }
        ]
      : [
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
          <div className="hidden lg:flex items-center space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                className={cn(
                  'flex items-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  pathname === item.href
                    ? 'text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground',
                  isAdmin && 'px-3 py-2 rounded-md hover:bg-accent'
                )}
              >
                {isAdmin && 'icon' in item && item.icon && <item.icon className="mr-2 h-4 w-4" />}
                {item.name}
              </Link>
            ))}
          </div>

          {/* Right side icons */}
          <div className="flex items-center space-x-4">
            {!isAdmin && (
              <Link
                href="/cart"
                className="p-2 text-foreground/80 hover:text-foreground transition-colors relative"
                aria-label="Carrito de compras"
              >
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <span
                    className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center"
                    aria-live="polite"
                  >
                    {totalItems}
                  </span>
                )}
              </Link>
            )}

            {/* Menú de usuario autenticado */}
            {status === 'authenticated' ? (
              <div className="hidden md:block relative">
                <button
                  className="flex items-center space-x-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  aria-haspopup="true"
                  aria-expanded={isUserMenuOpen}
                  aria-controls="user-menu"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                >
                  <User className="cursor-pointer h-6 w-6 transition-all duration-300 hover:scale-105 active:scale-95 " />
                </button>
                {isUserMenuOpen && (
                  <div
                    id="user-menu"
                    role="menu"
                    className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-popover border border-border py-1 z-50"
                    onMouseLeave={() => setIsUserMenuOpen(false)}
                  >
                    {!isAdmin && (
                      <Link
                        href="/dashboard"
                        className="block px-4 py-2 text-sm text-foreground hover:bg-accent"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        Mi Cuenta
                      </Link>
                    )}
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
                <Button variant="outline" size="sm" asChild className="text-sm">
                  <Link href="/login">Iniciar Sesión</Link>
                </Button>
                <Button size="sm" asChild className="text-sm">
                  <Link href="/register">Registrarse</Link>
                </Button>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              className="lg:hidden p-3 text-foreground hover:text-primary focus:outline-none min-h-[44px] min-w-[44px] flex items-center justify-center"
              onClick={() => setIsMobileOpen(!isMobileOpen)}
              aria-expanded={isMobileOpen}
              aria-label="Menú de navegación"
              aria-controls="mobile-menu"
            >
              {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileOpen && (
          <div id="mobile-menu" className="lg:hidden pt-2 pb-4 space-y-4 animate-in slide-in-from-top-2 duration-300">
            <div className="px-2 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'block px-3 py-3 rounded-md text-base font-medium min-h-[44px] flex items-center',
                    pathname === item.href
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                  onClick={() => setIsMobileOpen(false)}
                >
                  {isAdmin && 'icon' in item && item.icon && <item.icon className="mr-3 h-5 w-5" />}
                  {item.name}
                </Link>
              ))}

              {/* Auth Links */}
              {authItems.map((item) =>
                item.href ? (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="block px-3 py-3 rounded-md text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground min-h-[44px] flex items-center"
                    onClick={() => setIsMobileOpen(false)}
                  >
                    {item.name}
                  </Link>
                ) : (
                  <button
                    key={item.name}
                    onClick={() => {
                      item.onClick?.();
                      setIsMobileOpen(false);
                    }}
                    className="w-full text-left px-3 py-3 rounded-md text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground min-h-[44px] flex items-center"
                  >
                    {item.name}
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Navbar;

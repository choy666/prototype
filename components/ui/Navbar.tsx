'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, Menu, X, House } from 'lucide-react';
import '../../app/globals.css';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { name: 'Inicio', href: '/' },
    { name: 'Productos', href: '/products' },
    { name: 'Iniciar Sesión', href: '/login' },
  ];

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-200 border-b border-[#E4E5E7] ${
        isScrolled ? 'bg-[var(--color-footer)]/80 backdrop-blur-md' : 'bg-[var(--color-footer)]'
      }`}
    >
      <nav className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8' aria-label='Top'>
        <div className='flex justify-between items-center h-16'>
          {/* Logo */}
          <div className='flex-shrink-0 flex items-center'>
            <Link
              href='/'
              className='flex items-center group transition-all duration-300 hover:scale-105 active:scale-95'
            >
              <House className='h-6 w-6 mr-2 fill-[var(--color-page)] stroke-[var(--color-page)] transition-transform duration-300 group-hover:rotate-6' />
              <span className='text-xl font-bold text-[var(--color-page)] transition-colors duration-300 group-hover:opacity-80'>
                MiTienda
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className='hidden md:flex items-center space-x-8'>
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`text-sm font-medium ${
                  pathname === item.href
                    ? 'text-black'
                    : 'text-gray-600 hover:text-[var(--color-page)]'
                } transition-colors`}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Right side icons */}
          <div className='flex items-center space-x-4'>
            <div className='hidden md:block relative'>
              <input
                type='text'
                placeholder='Buscar productos...'
                className='w-64 px-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent'
              />
              <button className='absolute right-3 top-2.5 text-gray-400'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='h-4 w-4'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
                  />
                </svg>
              </button>
            </div>

            <Link href='/cart' className='p-2 text-gray-700 group'>
              <div className='relative'>
                <ShoppingCart
                  className='h-6 w-6 fill-[var(--color-page)] stroke-[var(--color-page)]
                transition-transform duration-300 group-hover:scale-110 group-active:scale-90'
                />
                <span className='absolute -top-1 -right-1 bg-black text-white text-xs rounded-full h-4 w-4 flex items-center justify-center'>
                  0
                </span>
              </div>
            </Link>

            {/* Mobile menu button */}
            <button
              className='md:hidden p-2 text-gray-700 hover:text-[var(--color-page)] focus:outline-none'
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className='h-6 w-6' /> : <Menu className='h-6 w-6' />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isOpen && (
          <div className='md:hidden pt-2 pb-4'>
            <div className='px-2 space-y-1'>
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    pathname === item.href
                    ? 'text-[var(--color-page)] font-semibold'
                    : 'text-gray-600 hover:text-[var(--color-page)] dark:text-gray-300 dark:hover:text-white'
                } transition-colors`}
                  onClick={() => setIsOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <div className='mt-4'>
                <input
                  type='text'
                  placeholder='Buscar productos...'
                  className='w-full px-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent'
                />
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Navbar;

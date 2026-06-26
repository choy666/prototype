import Link from 'next/link';
import { Facebook, Twitter, Instagram, Shield } from 'lucide-react';
import '../../app/globals.css';
const Footer = () => {
  const currentYear = new Date().getFullYear();

  const social = [
    {
      name: 'Facebook',
      href: '#',
      icon: Facebook,
    },
    {
      name: 'Instagram',
      href: '#',
      icon: Instagram,
    },
    {
      name: 'Twitter',
      href: '#',
      icon: Twitter,
    },
  ];

  return (
    <footer className='border-t border-border py-8 md:py-12'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12'>
          <div className='text-center'>
            <h3 className='text-xl font-bold text-foreground mb-4'>MiTienda</h3>
            <p className='text-muted-foreground text-base mb-6'>
              La mejor selección de productos de calidad para todos los gustos y necesidades.
            </p>
            <div className='flex justify-center space-x-6'>
              {social.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className='text-muted-foreground hover:text-foreground transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center'
                  aria-label={item.name}
                >
                  <item.icon className='h-6 w-6' aria-hidden='true' />
                </a>
              ))}
            </div>
          </div>
          <div className='text-center'>
            <h3 className='text-lg font-semibold text-foreground mb-4'>Contacto</h3>
            <ul role='list' className='space-y-3'>
              <li>
                <a
                  href='mailto:info@mitienda.com'
                  className='text-muted-foreground hover:text-foreground transition-colors text-base'
                >
                  info@mitienda.com
                </a>
              </li>
              <li>
                <a
                  href='tel:+1234567890'
                  className='text-muted-foreground hover:text-foreground transition-colors text-base'
                >
                  +1 (234) 567-890
                </a>
              </li>
              <li className='text-muted-foreground text-base'>123 Calle Falsa, Ciudad, País</li>
            </ul>
          </div>
        </div>
        <div className='mt-8 md:mt-12 border-t border-border pt-6 md:pt-8 text-center'>
          <Link
            href='#'
            className='text-muted-foreground hover:text-foreground flex items-center justify-center flex-col group transition-all duration-300 hover:scale-105 active:scale-95'
            aria-label="Ir al inicio"
          >
            &copy; {currentYear} LumenCommerce. Todos los derechos reservados.
            <Shield className='h-6 w-6 fill-current transition-transform duration-300 group-hover:rotate-6 mt-2' />
          </Link>
        </div>
      </div>
    </footer>
  );
};
export default Footer;
